from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from datetime import datetime
from .models import AccessRequest, RequestedSystem, Directorate, CustomUser, UserRole, AuditLog, SecurityPolicy, GlobalSettings
from .serializers import AccessRequestSerializer, RequestedSystemSerializer, DirectorateSerializer, CustomUserSerializer, AuditLogSerializer, SecurityPolicySerializer, GlobalSettingsSerializer, UserManagementSerializer
from .health_checks import check_database, check_email, get_server_stats

# --- HELPER: Sync Logic ---
def sync_request_status(request_obj):
    all_systems = request_obj.requested_systems.all()
    
    hod_pending = all_systems.filter(hod_status='pending').exists()
    if hod_pending:
        request_obj.status = 'pending_hod'
        request_obj.save()
        return

    hod_approved_exists = all_systems.filter(hod_status='approved').exists()
    if not hod_approved_exists:
        request_obj.status = 'rejected_hod'
        request_obj.save()
        return

    ict_pending = all_systems.filter(hod_status='approved', ict_status='pending').exists()
    if ict_pending:
        request_obj.status = 'pending_ict'
        request_obj.save()
        return

    ict_approved_exists = all_systems.filter(ict_status='approved').exists()
    if ict_approved_exists:
        request_obj.status = 'approved'
    else:
        request_obj.status = 'rejected_ict'
    
    request_obj.save()

class AccessRequestViewSet(viewsets.ModelViewSet):
    queryset = AccessRequest.objects.all() 
    serializer_class = AccessRequestSerializer
    authentication_classes = [TokenAuthentication] 
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AccessRequest.objects.filter(requester=self.request.user).order_by('-submitted_at')

    def perform_create(self, serializer):
        serializer.save(requester=self.request.user)

class RequestedSystemViewSet(viewsets.ModelViewSet):
    queryset = RequestedSystem.objects.all()
    serializer_class = RequestedSystemSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]

    def get_queryset(self):
        user = self.request.user
        queryset = RequestedSystem.objects.all()

        # Admin Logic
        if hasattr(user, 'userrole'):
            role = user.userrole.role
            
            # SysAdmin can only see their assigned system (unless superuser)
            if role == 'sys_admin' and not user.is_superuser:
                assigned_system = user.userrole.system_assigned
                if assigned_system:
                    queryset = queryset.filter(system=assigned_system)
                else:
                    return RequestedSystem.objects.none()

        # Filtering
        system_filter = self.request.query_params.get('system')
        user_filter = self.request.query_params.get('user_id')
        status_filter = self.request.query_params.get('status') # e.g. 'approved'

        if system_filter:
            queryset = queryset.filter(system=system_filter)
        if user_filter:
            queryset = queryset.filter(access_request__requester_id=user_filter)
        if status_filter:
            queryset = queryset.filter(sysadmin_status=status_filter)

        if status_filter:
            queryset = queryset.filter(sysadmin_status=status_filter)

        return queryset.order_by('-sysadmin_decision_date')

    @action(detail=False, methods=['get'])
    def active_assignments(self, request):
        """
        Returns a global list of all active system assignments for ALL users.
        Used by Super Admins to revoke rights.
        """
        # Filter for all approved systems
        active = RequestedSystem.objects.filter(
            sysadmin_status='approved'
        ).select_related('access_request', 'access_request__requester').order_by('-sysadmin_decision_date')

        # Pagination
        page = self.paginate_queryset(active)
        if page is not None:
            data = []
            for rs in page:
                data.append({
                    'id': rs.access_request.id, # Using Request ID for linking
                    'system_id': rs.id,         # Using System Assignment ID for unique action
                    'system_name': rs.get_system_display(),
                    'system_code': rs.system,   # Choice ID for revocation
                    'user_name': rs.access_request.requester.full_name,
                    'tsc_no': rs.access_request.tsc_no,
                    'granted_date': rs.sysadmin_decision_date,
                    'directorate': rs.access_request.directorate.name if rs.access_request.directorate else '-'
                })
            return self.get_paginated_response(data)

        # Fallback if pagination fails
        data = [{
            'id': rs.access_request.id,
            'system_id': rs.id,
            'system_name': rs.get_system_display(),
            'system_code': rs.system, # Choice ID
            'user_name': rs.access_request.requester.full_name,
            'tsc_no': rs.access_request.tsc_no,
            'granted_date': rs.sysadmin_decision_date,
            'directorate': rs.access_request.directorate.name if rs.access_request.directorate else '-'
        } for rs in active]
        return Response(data)

    @action(detail=False, methods=['get'])
    def available(self, request):
        """
        Returns the list of available systems for assignment.
        """
        choices = [{'id': k, 'name': v} for k, v in RequestedSystem.SYSTEM_CHOICES]
        return Response(choices)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """
        Immediate revocation of access by System Admin or Super Admin.
        """
        system_entry = self.get_object()
        user = request.user
        comment = request.data.get('comment', 'Access revoked by administrator.')
        
        # Permission Check
        if not user.is_superuser:
            if not hasattr(user, 'userrole'):
                 return Response({'error': 'Unauthorized'}, status=403)
            
            role = user.userrole.role
            if role == 'sys_admin':
                 # Can only revoke their own system
                 assigned = user.userrole.system_assigned
                 if str(system_entry.system) != str(assigned):
                     return Response({'error': 'Unauthorized: Cannot revoke other systems'}, status=403)
            elif role != 'super_admin':
                 return Response({'error': 'Unauthorized role'}, status=403)

        # Execute Revocation
        system_entry.sysadmin_status = 'revoked'
        system_entry.sysadmin_decision_date = timezone.now()
        system_entry.sysadmin_comment = f"[Revoked by {user.get_full_name()}] {comment}"
        system_entry.system_admin = user
        system_entry.save()

        # Audit Log
        try:
            AuditLog.objects.create(
                user=user,
                action="Access Revoked (Immediate)",
                target=f"{system_entry.get_system_display()} for {system_entry.access_request.requester.email}",
                ip_address=request.META.get('REMOTE_ADDR'),
                status="success"
            )
        except Exception:
            pass

        # Email Notification
        try:
            subject_tmpl = get_global_setting('email_access_revoked_subject', '[TSC] System Access Revoked: {system_name}')
            body_tmpl = get_global_setting('email_access_revoked_body', 'Dear {requester_name},\n\nYour access to {system_name} has been REVOKED.\n\nComments: {comment}')
            system_from = get_global_setting('system_email', getattr(settings, 'DEFAULT_FROM_EMAIL', 'webmaster@localhost'))

            context = {
                'requester_name': system_entry.access_request.requester.full_name,
                'system_name': system_entry.get_system_display(),
                'comment': comment
            }

            send_mail(
                subject=subject_tmpl.format(**context),
                message=body_tmpl.format(**context),
                from_email=system_from,
                recipient_list=[system_entry.access_request.requester.email],
                fail_silently=True
            )
        except Exception as e:
            print(f"Email error: {e}")

        return Response({'status': 'revoked'})

class DirectorateViewSet(viewsets.ModelViewSet):
    queryset = Directorate.objects.all()
    serializer_class = DirectorateSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]

    def get_queryset(self):
        user = self.request.user
        # Allow super admins to see all.
        # Allow regular users to ONLY see themselves (handled by 'me') or for specific lookups?
        # Ideally, we restrict listing all users to admins.
        # Helper validation for role filtering
        role_filter = self.request.query_params.get('role')
        search_term = self.request.query_params.get('search')

        queryset = CustomUser.objects.all().order_by('full_name')

        # 1. Base Access Control
        if not (user.is_superuser or (hasattr(user, 'userrole') and user.userrole.role in ['super_admin', 'sys_admin'])):
            # If not a super/sys admin, you can only see yourself
            queryset = queryset.filter(id=user.id)
        
        # 2. Filtering
        if role_filter and role_filter != 'all':
            # Filter by OneToOne UserRole relation
            # Check if we need to filter for 'staff' explicitly (which is default) or just the role field
            queryset = queryset.filter(userrole__role=role_filter)

        if search_term:
            queryset = queryset.filter(
                Q(full_name__icontains=search_term) |
                Q(email__icontains=search_term) |
                Q(tsc_no__icontains=search_term)
            ).distinct()

        return queryset

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return UserManagementSerializer
        return CustomUserSerializer

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        data = serializer.data
        if request.user.directorate:
            data['directorate_id'] = request.user.directorate.id
            data['directorate_name'] = request.user.directorate.name
        return Response(data)

    @action(detail=False, methods=['get'])
    def my_systems(self, request):
        """
        Returns a list of systems the user currently has rights to,
        derived from their approved request history.
        """
        user = request.user
        
        # 1. Fetch all system requests for this user that reached a final state (approved/revoked)
        # We need to look at the history of what happened.
        # Logic: 
        # - Group by System ID
        # - Order by decision date (latest first)
        # - Check the status of the latest request
        
        from collections import defaultdict
        
        # Fetch all requested systems for this user where the process is complete (sysadmin handled it)
        # We also include 'approved' (meaning active) and 'revoked'
        # We need to be careful: a 'new' request that is 'approved' = ACTIVE
        # A 'deactivate' request that is 'approved' = INACTIVE
        # A 'modify' request that is 'approved' = ACTIVE (technically 'modify' implies existing, but here we treat it as active)
        # Any request that is 'revoked' = INACTIVE
        
        user_systems = RequestedSystem.objects.filter(
            access_request__tsc_no=user.tsc_no,
            sysadmin_status__in=['approved', 'revoked'] # Only care about finalized admin decisions
        ).select_related('access_request').order_by('system', '-sysadmin_decision_date')
        
        system_status_map = {}
        
        for rs in user_systems:
            sys_id = rs.system
            
            # Since we ordered by date desc, the first one we see is the latest status
            if sys_id not in system_status_map:
                # Determine status
                is_active = False
                
                if rs.sysadmin_status == 'revoked':
                    is_active = False
                elif rs.sysadmin_status == 'approved':
                    # If approved, check request type
                    req_type = rs.access_request.request_type
                    if req_type == 'deactivate':
                        is_active = False
                    else:
                        # 'new' or 'modify' -> Active
                        is_active = True
                
                if is_active:
                    system_status_map[sys_id] = {
                        'system': rs.system,
                        'system_display': rs.get_system_display(),
                        'granted_date': rs.sysadmin_decision_date,
                        'request_id': rs.access_request.id
                    }
                else:
                    # Explicitly mark as inactive so we don't process older records for this system
                    system_status_map[sys_id] = None

        # Filter out None values (inactive systems)
        active_systems = [s for s in system_status_map.values() if s is not None]
        
        return Response(active_systems)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]

class SecurityPolicyViewSet(viewsets.ModelViewSet):
    queryset = SecurityPolicy.objects.all()
    serializer_class = SecurityPolicySerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]

    def perform_update(self, serializer):
        previous_instance = self.get_object()
        instance = serializer.save()
        
        # Log the change
        try:
            user = self.request.user
            status_text = "enabled" if instance.is_enabled else "disabled"
            AuditLog.objects.create(
                user=user,
                action="Security Policy Update",
                target=f"{instance.name} ({status_text})",
                ip_address=self.request.META.get('REMOTE_ADDR'),
                status="success"
            )
        except Exception as e:
            print(f"Error logging security policy update: {e}")

class GlobalSettingsViewSet(viewsets.ModelViewSet):
    queryset = GlobalSettings.objects.all()
    serializer_class = GlobalSettingsSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser

# ...

class GlobalSettingsViewSet(viewsets.ModelViewSet):
    queryset = GlobalSettings.objects.all()
    serializer_class = GlobalSettingsSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'seed']:
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return GlobalSettings.objects.all()
        
        # Check if user has admin role
        is_admin = False
        if hasattr(user, 'userrole') and user.userrole.role in ['super_admin', 'sys_admin']:
            is_admin = True
            
        if is_admin:
            return GlobalSettings.objects.all()
        
        return GlobalSettings.objects.filter(is_public=True)

    @action(detail=False, methods=['post'])
    def seed(self, request):
        # 1. Security Policies
        policies = [
            {'key': 'mfa', 'name': 'Multi-Factor Authentication', 'description': 'Require all administrators to use 2FA for login access.', 'is_enabled': True},
            {'key': 'ip_whitelist', 'name': 'IP Whitelisting', 'description': 'Restrict system access to known corporate IP ranges only.', 'is_enabled': False},
            {'key': 'strong_password', 'name': 'Strong Password Policy', 'description': 'Enforce complexity requirements (12+ chars, symbols, mixed case).', 'is_enabled': True},
            {'key': 'session_timeout', 'name': 'Session Timeout', 'description': 'Automatically log out users after 15 minutes of inactivity.', 'is_enabled': True},
        ]
        for p in policies:
            SecurityPolicy.objects.get_or_create(key=p['key'], defaults=p)

        # 2. Global Settings
        from django.conf import settings as django_settings
        settings_list = [
            {'key': 'system_name', 'label': 'System Name', 'value': 'TSC System Access Portal', 'group': 'general', 'is_public': True},
            {'key': 'support_email', 'label': 'Support Email Address', 'value': 'support@tsc.go.ke', 'group': 'general', 'is_public': True},
            {'key': 'ict_email', 'label': 'ICT Team Email', 'value': getattr(django_settings, 'ICT_TEAM_EMAIL', ''), 'group': 'general', 'is_public': False},
            {'key': 'system_email', 'label': 'System Email (Outgoing)', 'value': getattr(django_settings, 'EMAIL_HOST_USER', ''), 'group': 'general', 'is_public': False},
            {'key': 'max_session_duration', 'label': 'Max Session Duration (Minutes)', 'value': '15', 'group': 'general', 'is_public': True},
            {'key': 'maintenance_mode', 'label': 'Maintenance Mode', 'value': 'false', 'group': 'maintenance', 'is_public': True},

            # Email Templates: HOD Approval (to ICT)
            {'key': 'email_hod_approval_subject', 'label': 'HOD Approval Subject (to ICT)', 'value': '[TSC] New Approved Systems for {requester_name}', 'group': 'notification', 'is_public': False},
            {'key': 'email_hod_approval_body', 'label': 'HOD Approval Body (to ICT)', 'value': 'The following systems have been approved by HOD and are ready for ICT review:\n\nRequester: {requester_name} ({tsc_no})\nDirectorate: {directorate}\n\nSystems:\n{system_list}\n\nPlease log in to the ICT Dashboard to action these requests.', 'group': 'notification', 'is_public': False},

            # Email Templates: HOD Review (to Requester)
            {'key': 'email_hod_review_subject', 'label': 'HOD Review Subject (to Requester)', 'value': '[TSC] HOD Review Complete - System Access Request', 'group': 'notification', 'is_public': False},
            {'key': 'email_hod_review_body', 'label': 'HOD Review Body (to Requester)', 'value': 'Dear {requester_name},\n\nYour HOD has completed the review of your system access request.\n\nSummary:\n{summary_list}\n\nApproved systems have been forwarded to ICT for further processing.\n\nRegards,\nTSC System Access', 'group': 'notification', 'is_public': False},

            # Email Templates: ICT Review (to Requester)
            {'key': 'email_ict_review_subject', 'label': 'ICT Review Subject (to Requester)', 'value': '[TSC] ICT Review Complete - System Access Request', 'group': 'notification', 'is_public': False},
            {'key': 'email_ict_review_body', 'label': 'ICT Review Body (to Requester)', 'value': 'Dear {requester_name},\n\nThe ICT Team has completed the review of your system access request.\n\nSummary:\n{summary_list}\n\nApproved systems have been forwarded to the respective System Administrators for provisioning.\n\nRegards,\nTSC ICT Team', 'group': 'notification', 'is_public': False},

            # Email Templates: System Admin Actions (Grant/Revoke/Reject)
            {'key': 'email_access_granted_subject', 'label': 'Access Granted Subject', 'value': '[TSC] System Access Granted: {system_name}', 'group': 'notification', 'is_public': False},
            {'key': 'email_access_granted_body', 'label': 'Access Granted Body', 'value': 'Dear {requester_name},\n\nYour request for access to {system_name} has been APPROVED and provisioned.\n\nComments: {comment}\n\nYou can now access the system.\n\nRegards,\nTSC System Admin', 'group': 'notification', 'is_public': False},

            {'key': 'email_access_revoked_subject', 'label': 'Access Revoked Subject', 'value': '[TSC] System Access Revoked: {system_name}', 'group': 'notification', 'is_public': False},
            {'key': 'email_access_revoked_body', 'label': 'Access Revoked Body', 'value': 'Dear {requester_name},\n\nYour access to {system_name} has been REVOKED as requested.\n\nComments: {comment}\n\nRegards,\nTSC System Admin', 'group': 'notification', 'is_public': False},

            {'key': 'email_request_rejected_subject', 'label': 'Request Rejected Subject', 'value': '[TSC] System Access Request Rejected: {system_name}', 'group': 'notification', 'is_public': False},
            {'key': 'email_request_rejected_body', 'label': 'Request Rejected Body', 'value': 'Dear {requester_name},\n\nYour request for access to {system_name} has been REJECTED.\n\nReason: {comment}\n\nRegards,\nTSC System Admin', 'group': 'notification', 'is_public': False},
        ]
        for s in settings_list:
            GlobalSettings.objects.update_or_create(key=s['key'], defaults=s)

        # 3. Dummy Audit Logs
        if AuditLog.objects.count() == 0:
            AuditLog.objects.create(user=request.user, action="System Initialization", target="Database", status="success", ip_address="127.0.0.1")
            AuditLog.objects.create(user=request.user, action="Security Policy Update", target="MFA Policy", status="success", ip_address="127.0.0.1")

        return Response({"status": "Database seeded successfully"})



def get_global_setting(key, default_val=None):
    try:
        setting = GlobalSettings.objects.get(key=key)
        return setting.value if setting.value else default_val
    except GlobalSettings.DoesNotExist:
        return default_val

class ApprovalViewSet(viewsets.ReadOnlyModelViewSet):
    # ... (viewset setup remains same)
    serializer_class = AccessRequestSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]

    def get_queryset(self):
        # ... (queryset logic remains same - omitting for brevity as tool context handles replacement scope)
        user = self.request.user
        if hasattr(user, 'userrole'):
            role = user.userrole.role
        elif user.is_superuser:
            role = 'super_admin'
        
        if not role:
            return AccessRequest.objects.none()
        tab = self.request.query_params.get('tab', 'pending')
        search_term = self.request.query_params.get('search', '')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        queryset = AccessRequest.objects.none()
        
        if role == 'hod':
            directorate = user.userrole.directorate
            if not directorate:
                return AccessRequest.objects.none()
            
            if tab == 'history':
                queryset = AccessRequest.objects.filter(hod_approver=user)
            else:
                queryset = AccessRequest.objects.filter(
                    directorate=directorate,
                    requested_systems__hod_status='pending'
                )

        elif role == 'ict':
            if tab == 'history':
                # FIX: Use subquery to strictly match stats calculation logic
                # Stats uses: RequestedSystem.objects.exclude(ict_status='pending')
                processed_system_ids = RequestedSystem.objects.exclude(ict_status='pending').values('access_request')
                queryset = AccessRequest.objects.filter(id__in=processed_system_ids).distinct()
            else:
                queryset = AccessRequest.objects.filter(
                    requested_systems__hod_status='approved',
                    requested_systems__ict_status='pending'
                )

        elif role == 'sys_admin':
            assigned_system = user.userrole.system_assigned
            if assigned_system:
                if tab == 'history':
                    queryset = AccessRequest.objects.filter(
                        requested_systems__system=assigned_system,
                        requested_systems__sysadmin_status__in=['approved', 'rejected', 'revoked']
                    )
                else:
                    queryset = AccessRequest.objects.filter(
                        requested_systems__system=assigned_system,
                        requested_systems__ict_status='approved',
                        requested_systems__sysadmin_status='pending'
                    )

        elif role == 'super_admin':
            pending_query = (
                Q(status__in=['pending_hod', 'pending_ict']) | 
                Q(requested_systems__sysadmin_status='pending')
            )
            
            if tab == 'history':
                queryset = AccessRequest.objects.exclude(pending_query).distinct()
            elif tab == 'all':
                queryset = AccessRequest.objects.all().distinct()
            else:
                queryset = AccessRequest.objects.filter(pending_query).distinct()
        
        if search_term:
            queryset = queryset.filter(
                Q(tsc_no__icontains=search_term) | 
                Q(requester__full_name__icontains=search_term)
            )
        
        if start_date and end_date:
            try:
                s_date = datetime.strptime(start_date, '%Y-%m-%d')
                e_date = datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                if timezone.is_aware(timezone.now()):
                     s_date = timezone.make_aware(s_date)
                     e_date = timezone.make_aware(e_date)
                
                queryset = queryset.filter(submitted_at__range=(s_date, e_date))
            except ValueError:
                pass 
        
        # DEBUG LIST COUNT
        try: 
            print(f"DEBUG LIST COUNT for {role}, tab={tab}: {queryset.count()}")
        except: pass

        return queryset.distinct().order_by('-submitted_at')

    @action(detail=True, methods=['post'])
    def decide(self, request, pk=None):
        access_request = self.get_object()
        system_id = request.data.get('system_id')
        action = request.data.get('action')
        comment = request.data.get('comment', '')

        if not system_id or action not in ['approve', 'reject']:
            return Response({'error': 'Invalid data'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            system = RequestedSystem.objects.get(id=system_id, access_request=access_request)
        except RequestedSystem.DoesNotExist:
            return Response({'error': 'System not found in this request'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        role = getattr(user.userrole, 'role', None)

        if role == 'hod':
            if user.userrole.directorate != access_request.directorate:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
            system.hod_decision_date = timezone.now()
            system.hod_comment = comment
            if action == 'approve':
                system.hod_status = 'approved'
            else:
                system.hod_status = 'rejected'
                system.ict_status = 'rejected' 
            
            system.save()
            access_request.hod_approver = user 
            access_request.save()

        elif role == 'ict':
            if system.hod_status != 'approved':
                 return Response({'error': 'System must be HOD approved first'}, status=status.HTTP_400_BAD_REQUEST)

            system.ict_decision_date = timezone.now()
            system.ict_comment = comment
            if action == 'approve':
                system.ict_status = 'approved'
            else:
                system.ict_status = 'rejected'
            
            system.save()
            access_request.ict_approver = user
            access_request.save()

        elif role == 'sys_admin':
            assigned_system = user.userrole.system_assigned
            if not assigned_system or system.system != assigned_system:
                return Response({'error': 'Unauthorized: Not assigned to this system'}, status=status.HTTP_403_FORBIDDEN)
            
            if system.ict_status != 'approved':
                return Response({'error': 'System must be ICT approved first'}, status=status.HTTP_400_BAD_REQUEST)

            system.sysadmin_decision_date = timezone.now()
            system.sysadmin_comment = comment
            
            if action == 'approve':
                system.sysadmin_status = 'approved'
            else:
                system.sysadmin_status = 'rejected'
            
            system.system_admin = user
            system.save()
            
            # --- EMAIL NOTIFICATION (Immediate for SysAdmin) ---
            email_type = 'rejected'
            if action == 'approve':
                if access_request.request_type == 'deactivate':
                    email_type = 'revoked'
                else:
                    email_type = 'granted'
            
            # Fetch templates
            subject_key = f'email_access_{email_type}_subject' if email_type != 'rejected' else 'email_request_rejected_subject'
            body_key = f'email_access_{email_type}_body' if email_type != 'rejected' else 'email_request_rejected_body'
            
            subject_tmpl = get_global_setting(subject_key, f'[TSC] System Access {email_type.title()}: {{system_name}}')
            body_tmpl = get_global_setting(body_key, f'Dear {{requester_name}},\n\nYour access to {{system_name}} has been {email_type.upper()}.\n\nComment: {{comment}}')

            system_from = get_global_setting('system_email', getattr(settings, 'DEFAULT_FROM_EMAIL', 'webmaster@localhost'))
            
            context = {
                'requester_name': access_request.requester.full_name,
                'system_name': system.get_system_display(),
                'comment': comment or 'No comments provided.'
            }
            
            send_mail(
                subject=subject_tmpl.format(**context),
                message=body_tmpl.format(**context),
                from_email=system_from,
                recipient_list=[access_request.requester.email],
                fail_silently=True,
            )

        elif role == 'super_admin':
            # SUPER ADMIN SMART OVERRIDE
            # Acts as the current pending approver to unblock workflow.
            now = timezone.now()
            
            if action == 'approve':
                if system.hod_status == 'pending':
                    # Act as HOD
                    system.hod_status = 'approved'
                    system.hod_decision_date = now
                    system.hod_approver = user
                    system.hod_comment = f"[Super Admin acting as HOD] {comment}"
                    system.save()
                    role = 'hod' # Masquerade for bundled email logic
                
                elif system.ict_status == 'pending':
                    # Act as ICT
                    system.ict_status = 'approved'
                    system.ict_decision_date = now
                    system.ict_approver = user
                    system.ict_comment = f"[Super Admin acting as ICT] {comment}"
                    system.save()
                    role = 'ict' # Masquerade for bundled email logic

                elif system.sysadmin_status == 'pending':
                    # Act as System Admin
                    system.sysadmin_status = 'approved'
                    system.sysadmin_decision_date = now
                    system.system_admin = user
                    system.sysadmin_comment = f"[Super Admin acting as SysAdmin] {comment}"
                    system.save()
                    
                    # --- EMAIL NOTIFICATION (Immediate for SysAdmin Action) ---
                    email_type = 'granted'
                    if access_request.request_type == 'deactivate':
                        email_type = 'revoked'

                    # Fetch templates
                    subject_key = f'email_access_{email_type}_subject'
                    body_key = f'email_access_{email_type}_body'
                    
                    subject_tmpl = get_global_setting(subject_key, f'[TSC] System Access {email_type.title()}: {{system_name}}')
                    body_tmpl = get_global_setting(body_key, f'Dear {{requester_name}},\n\nYour access to {{system_name}} has been {email_type.upper()}.\n\nComment: {{comment}}')

                    system_from = get_global_setting('system_email', getattr(settings, 'DEFAULT_FROM_EMAIL', 'webmaster@localhost'))
                    
                    context = {
                        'requester_name': access_request.requester.full_name,
                        'system_name': system.get_system_display(),
                        'comment': f"[Super Admin acting as SysAdmin] {comment}" if comment else "[Super Admin acting as SysAdmin]"
                    }
                    
                    send_mail(
                        subject=subject_tmpl.format(**context),
                        message=body_tmpl.format(**context),
                        from_email=system_from,
                        recipient_list=[access_request.requester.email],
                        fail_silently=True,
                    )
            
            else:
                # FORCE REJECT (Nuclear Option)
                # Rejects the system entirely, irrelevant of stage.
                system.sysadmin_status = 'rejected'
                system.sysadmin_decision_date = now
                system.system_admin = user
                system.sysadmin_comment = f"[Super Admin Override] {comment}"
                
                # Also reject previous pending stages to clear them
                if system.hod_status == 'pending': system.hod_status = 'rejected'
                if system.ict_status == 'pending': system.ict_status = 'rejected'
                
                system.save()
                
                # --- EMAIL NOTIFICATION (Rejection) ---
                email_type = 'rejected'
                subject_key = 'email_request_rejected_subject'
                body_key = 'email_request_rejected_body'
                
                subject_tmpl = get_global_setting(subject_key, f'[TSC] System Access Request Rejected: {{system_name}}')
                body_tmpl = get_global_setting(body_key, f'Dear {{requester_name}},\n\nYour request for access to {{system_name}} has been REJECTED.\n\nReason: {{comment}}')

                system_from = get_global_setting('system_email', getattr(settings, 'DEFAULT_FROM_EMAIL', 'webmaster@localhost'))
                
                context = {
                    'requester_name': access_request.requester.full_name,
                    'system_name': system.get_system_display(),
                    'comment': f"[Super Admin Override] {comment}" if comment else "[Super Admin Override]"
                }
                
                send_mail(
                    subject=subject_tmpl.format(**context),
                    message=body_tmpl.format(**context),
                    from_email=system_from,
                    recipient_list=[access_request.requester.email],
                    fail_silently=True,
                )

        else:
            return Response({'error': 'Unauthorized role'}, status=status.HTTP_403_FORBIDDEN)

        # Sync master status
        sync_request_status(access_request)

        # --- AUDIT LOGGING ---
        try:
            AuditLog.objects.create(
                user=user,
                action=f"{role.upper()} {action.title()} System Access",
                target=f"{system.get_system_display()} (REQ-{access_request.id})",
                ip_address=request.META.get('REMOTE_ADDR'),
                status="success"
            )
        except Exception as e:
            print(f"Audit Log Error: {e}") 
        
        # --- BUNDLED EMAIL LOGIC ---
        
        # Fetch Dynamic Settings
        ict_team_email = get_global_setting('ict_email', getattr(settings, 'ICT_TEAM_EMAIL', ''))
        system_from_email = get_global_setting('system_email', getattr(settings, 'DEFAULT_FROM_EMAIL', 'webmaster@localhost'))

        if role == 'hod':
            pending_hod = access_request.requested_systems.filter(hod_status="pending").exists()
            
            if not pending_hod:
                approved_systems = access_request.requested_systems.filter(hod_status="approved")
                if approved_systems.exists():
                    system_list = "\n".join([f"- {s.get_system_display()}" for s in approved_systems])
                    recipient_list = [ict_team_email] if ict_team_email else []
                    
                    if recipient_list:
                        # HOD Approval (to ICT)
                        subject_tmpl = get_global_setting('email_hod_approval_subject', '[TSC] New Approved Systems for {requester_name}')
                        body_tmpl = get_global_setting('email_hod_approval_body', 'Requester: {requester_name}\nSystems:\n{system_list}')
                        
                        context = {
                            'requester_name': access_request.requester.full_name,
                            'tsc_no': access_request.tsc_no,
                            'directorate': access_request.directorate.name if access_request.directorate else '-',
                            'system_list': system_list
                        }
                        
                        send_mail(
                            subject=subject_tmpl.format(**context),
                            message=body_tmpl.format(**context),
                            from_email=system_from_email,
                            recipient_list=recipient_list,
                            fail_silently=True,
                        )

                all_systems = access_request.requested_systems.all()
                summary_list = "\n".join([f"- {s.get_system_display()}: {s.hod_status.upper()}" for s in all_systems])
                
                # HOD Review (to Requester)
                subject_tmpl = get_global_setting('email_hod_review_subject', '[TSC] HOD Review Complete')
                body_tmpl = get_global_setting('email_hod_review_body', 'Dear {requester_name},\nSummary:\n{summary_list}')
                
                context = {
                    'requester_name': access_request.requester.full_name,
                    'summary_list': summary_list
                }

                send_mail(
                    subject=subject_tmpl.format(**context),
                    message=body_tmpl.format(**context),
                    from_email=system_from_email,
                    recipient_list=[access_request.requester.email],
                    fail_silently=True,
                )

        elif role == 'ict':
            pending_ict = access_request.requested_systems.filter(ict_status="pending").exists()

            if not pending_ict:
                all_systems = access_request.requested_systems.all()
                summary_list = "\n".join([f"- {s.get_system_display()}: {s.ict_status.upper()}" for s in all_systems])
                
                # ICT Review (to Requester)
                subject_tmpl = get_global_setting('email_ict_review_subject', '[TSC] ICT Review Complete')
                body_tmpl = get_global_setting('email_ict_review_body', 'Dear {requester_name},\nSummary:\n{summary_list}')
                
                context = {
                    'requester_name': access_request.requester.full_name,
                    'summary_list': summary_list
                }

                send_mail(
                    subject=subject_tmpl.format(**context),
                    message=body_tmpl.format(**context),
                    from_email=system_from_email,
                    recipient_list=[access_request.requester.email],
                    fail_silently=True,
                )

        return Response({'status': 'success', 'system_status': action})

    @action(detail=False, methods=['get'])
    def system_health(self, request):
        """
        Returns real-time system health status.
        """
        # Ensure only admins can see this
        user = request.user
        if not (user.is_superuser or (hasattr(user, 'userrole') and user.userrole.role in ['super_admin', 'sys_admin'])):
             return Response({'error': 'Unauthorized'}, status=403)
            
        db_status = check_database()
        email_status = check_email()
        server_stats = get_server_stats()
        
        data = {
            'database': db_status,
            'email': email_status,
            'server': server_stats,
            'api_latency': '24ms' # Placeholder or can calculate request time
        }
        
        return Response(data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Returns statistics for the dashboard cards.
        """
        user = request.user
        print(f"Stats requested for user: {user.email}") # Debug: Confirm code reload
        role = None
        if hasattr(user, 'userrole'):
            role = user.userrole.role
        elif user.is_superuser:
            role = 'super_admin'

        if not role:
            return Response({'error': 'No role assigned'}, status=403)
            
        # Update last_login to ensure Realtime Activity is accurate
        from django.contrib.auth.models import update_last_login
        update_last_login(None, user)
        
        data = {
            'pending_systems': 0,
            'overdue_requests': 0,
            'reviewed_today': 0,
            'total_history': 0,
            'approved_history': 0,
            'rejected_history': 0
        }

        if role == 'hod':
            directorate = user.userrole.directorate
            if directorate:
                # Pending Stats
                pending_qs = RequestedSystem.objects.filter(
                    access_request__directorate=directorate, 
                    hod_status='pending'
                )
                data['pending_systems'] = pending_qs.values('access_request').distinct().count()

                # Overdue (> 3 days)
                three_days_ago = timezone.now() - timezone.timedelta(days=3)
                data['overdue_requests'] = pending_qs.filter(
                    access_request__submitted_at__lt=three_days_ago
                ).values('access_request').distinct().count()

                # Reviewed Today
                today = timezone.now().date()
                data['reviewed_today'] = RequestedSystem.objects.filter(
                    access_request__directorate=directorate,
                    hod_decision_date__date=today
                ).exclude(hod_status='pending').values('access_request').distinct().count()

                # History Stats
                history_qs = RequestedSystem.objects.filter(
                    access_request__directorate=directorate
                ).exclude(hod_status='pending')
                
                data['total_history'] = history_qs.values('access_request').distinct().count()
                data['approved_history'] = history_qs.filter(hod_status='approved').values('access_request').distinct().count()
                data['rejected_history'] = history_qs.filter(hod_status='rejected').values('access_request').distinct().count()

        elif role == 'ict':
            # Pending Stats (Must be HOD Approved)
            pending_qs = RequestedSystem.objects.filter(
                hod_status='approved',
                ict_status='pending'
            )
            data['pending_systems'] = pending_qs.values('access_request').distinct().count()

            # Overdue (> 3 days from HOD Approval)
            three_days_ago = timezone.now() - timezone.timedelta(days=3)
            data['overdue_requests'] = pending_qs.filter(
                hod_decision_date__lt=three_days_ago
            ).values('access_request').distinct().count()

            # Reviewed Today
            today = timezone.now().date()
            data['reviewed_today'] = RequestedSystem.objects.filter(
                ict_decision_date__date=today
            ).exclude(ict_status='pending').values('access_request').distinct().count()

            # History Stats
            history_qs = RequestedSystem.objects.exclude(ict_status='pending')
            
            # DEBUG LOGGING FOR ICT
            try:
                import os
                debug_path = os.path.join(settings.BASE_DIR.parent, 'ict_stats_debug.txt')
                with open(debug_path, 'w') as f:
                    f.write(f"ICT Stats Calc at {timezone.now()}\n")
                    f.write(f"Pending QS Count (Sys): {pending_qs.count()}\n")
                    f.write(f"Pending QS Count (Req): {pending_qs.values('access_request').distinct().count()}\n")
                    f.write(f"History QS Count (Sys): {history_qs.count()}\n")
                    f.write(f"History QS Count (Req): {history_qs.values('access_request').distinct().count()}\n")
            except Exception as e:
                print(f"Log Error: {e}")

            data['total_history'] = history_qs.values('access_request').distinct().count()
            data['approved_history'] = history_qs.filter(ict_status='approved').values('access_request').distinct().count()
            data['rejected_history'] = history_qs.filter(ict_status='rejected').values('access_request').distinct().count()

        elif role == 'sys_admin':
            assigned_system = user.userrole.system_assigned
            if assigned_system:
                # Pending Stats (Must be ICT Approved)
                pending_qs = RequestedSystem.objects.filter(
                    system=assigned_system,
                    ict_status='approved',
                    sysadmin_status='pending'
                )
                data['pending_systems'] = pending_qs.count()

                # Overdue (> 3 days from ICT Approval)
                three_days_ago = timezone.now() - timezone.timedelta(days=3)
                data['overdue_requests'] = pending_qs.filter(
                    ict_decision_date__lt=three_days_ago
                ).count()

                # Reviewed Today
                today = timezone.now().date()
                data['reviewed_today'] = RequestedSystem.objects.filter(
                    system=assigned_system,
                    sysadmin_decision_date__date=today
                ).exclude(sysadmin_status='pending').count()

                # History Stats
                history_qs = RequestedSystem.objects.filter(
                    system=assigned_system,
                    sysadmin_status__in=['approved', 'rejected', 'revoked']
                )
                data['total_history'] = history_qs.count()
                data['approved_history'] = history_qs.filter(sysadmin_status='approved').count()
                data['rejected_history'] = history_qs.filter(sysadmin_status='rejected').count()

        elif role == 'super_admin':
            # Global Stats
            # Pending: Any system pending at any stage
            pending_qs = RequestedSystem.objects.filter(
                Q(hod_status='pending') | 
                Q(ict_status='pending') | 
                Q(sysadmin_status='pending')
            )
            data['pending_systems'] = pending_qs.count()

            # Overdue: Global simple check (submitted > 3 days ago and still pending)
            three_days_ago = timezone.now() - timezone.timedelta(days=3)
            data['overdue_requests'] = pending_qs.filter(
                access_request__submitted_at__lt=three_days_ago
            ).count()

            # Reviewed Today: Any decision made today by ANYONE (HOD, ICT, or SysAdmin)
            today = timezone.now().date()
            data['reviewed_today'] = RequestedSystem.objects.filter(
                Q(hod_decision_date__date=today) |
                Q(ict_decision_date__date=today) |
                Q(sysadmin_decision_date__date=today)
            ).count()

            # History: All requests ever made (Total Volume)
            all_requests_qs = RequestedSystem.objects.all()
            data['total_history'] = all_requests_qs.count()
            data['approved_history'] = all_requests_qs.filter(sysadmin_status='approved').count()
            data['rejected_history'] = all_requests_qs.filter(sysadmin_status='rejected').count()

            # Active Users (Live - Valid Token + Recent Activity)
            # Intersection of:
            # 1. token__isnull=False (Filters out explicitly logged out users instantly)
            # 2. last_login > 5 mins ago (Filters out "zombies" who closed tab)
            threshold = timezone.now() - timezone.timedelta(minutes=5)
            active_qs = CustomUser.objects.filter(auth_token__isnull=False, last_login__gte=threshold)
            data['active_users'] = active_qs.count()
            
            # Active Users by Role
            from django.db.models import Count
            role_distribution = active_qs.values('userrole__role').annotate(count=Count('id'))
            active_roles = {item['userrole__role']: item['count'] for item in role_distribution if item['userrole__role']}

            # Include Superusers who might not have a UserRole entry
            # (If they have a UserRole='super_admin', they are already counted above)
            orphan_superusers = active_qs.filter(is_superuser=True, userrole__isnull=True).count()
            if orphan_superusers > 0:
                 active_roles['super_admin'] = active_roles.get('super_admin', 0) + orphan_superusers

            data['active_roles'] = active_roles

            # --- DEBUG LOGGING START ---
            try:
                import os
                log_path = os.path.join(settings.BASE_DIR.parent, 'stats_debug.log') # Save to desktop/root
                with open(log_path, 'a') as f:
                    f.write(f"\n--- STATS REQUEST {timezone.now()} ---\n")
                    f.write(f"User: {request.user} | ID: {request.user.id} | Superuser: {request.user.is_superuser}\n")
                    f.write(f"Determined Role: {role}\n")
                    f.write(f"Calculated Data: {data}\n")
                    f.write("-------------------------------------\n")
            except Exception as e:
                print(f"Debug Log Error: {e}")
            # --- DEBUG LOGGING END ---

        return Response(data)





class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        # 1. Maintenance Mode Check
        try:
            maintenance_mode = GlobalSettings.objects.get(key='maintenance_mode').value.lower() == 'true'
        except GlobalSettings.DoesNotExist:
            maintenance_mode = False
        
        if maintenance_mode:
            is_admin = user.is_superuser
            if not is_admin and hasattr(user, 'userrole'):
                # Only explicitly defined admins can bypass maintenance
                is_admin = user.userrole.role in ['super_admin', 'sys_admin']
            
            if not is_admin:
                return Response(
                    {'non_field_errors': ['System is currently in maintenance mode. Only Administrators can access.']},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

        token, created = Token.objects.get_or_create(user=user)
        
        # Explicitly update last_login
        from django.contrib.auth.models import update_last_login
        update_last_login(None, user)
        
        # Explicitly log login action
        try:
            ip = request.META.get('REMOTE_ADDR')
            AuditLog.objects.create(
                user=user,
                action="User Login",
                target="Session",
                ip_address=ip,
                status="success"
            )
        except Exception as e:
            print(f"Error logging login event: {str(e)}")
        
        # Determine Role
        role = 'User'
        if hasattr(user, 'userrole'):
            role = user.userrole.role
        elif user.is_superuser:
            role = 'Super Admin'

        return Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email,
            'username': user.email.split('@')[0], 
            'role': role,
            'directorate': user.directorate.name if user.directorate else None
        })
        

from rest_framework.views import APIView

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]

    def post(self, request):
        # Log the logout action
        try:
            ip = request.META.get('REMOTE_ADDR')
            AuditLog.objects.create(
                user=request.user,
                action="User Logout",
                target="Session",
                ip_address=ip,
                status="success"
            )
            # Delete the token to invalidate the session
            request.user.auth_token.delete()
            return Response({"status": "Logged out successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
