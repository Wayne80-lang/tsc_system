from rest_framework import serializers
from .models import Directorate, AccessRequest, RequestedSystem, CustomUser, UserRole, AuditLog, SecurityPolicy, GlobalSettings

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_tsc_no = serializers.CharField(source='user.tsc_no', read_only=True, allow_null=True)
    role = serializers.CharField(source='user.userrole.get_role_display', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = '__all__'

class SecurityPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityPolicy
        fields = '__all__'

class GlobalSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalSettings
        fields = '__all__'

class DirectorateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Directorate
        fields = '__all__'

class CustomUserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='userrole.role', read_only=True)
    system_assigned = serializers.CharField(source='userrole.system_assigned', read_only=True)
    system_assigned_name = serializers.CharField(source='userrole.get_system_assigned_display', read_only=True)
    
    directorate_name = serializers.CharField(source='directorate.name', read_only=True)
    role_directorate_name = serializers.CharField(source='userrole.directorate.name', read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'tsc_no', 'full_name', 'email', 'directorate', 'directorate_name', 'role_directorate_name', 'is_active', 'is_staff', 'role', 'system_assigned', 'system_assigned_name']

class RequestedSystemSerializer(serializers.ModelSerializer):
    system_display = serializers.CharField(source='get_system_display', read_only=True)
    requester_name = serializers.CharField(source='access_request.requester.full_name', read_only=True)
    requester_email = serializers.CharField(source='access_request.requester.email', read_only=True)
    requester_tsc = serializers.CharField(source='access_request.requester.tsc_no', read_only=True)

    current_stage = serializers.SerializerMethodField()
    days_open = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    pending_approver = serializers.SerializerMethodField()

    class Meta:
        model = RequestedSystem
        fields = '__all__'
        extra_kwargs = {
            'access_request': {'read_only': True} 
        }

    def get_current_stage(self, obj):
        if obj.sysadmin_status == 'revoked': return 'Revoked'
        if obj.sysadmin_status == 'approved': return 'Active'
        if obj.sysadmin_status == 'rejected' or obj.ict_status == 'rejected' or obj.hod_status == 'rejected': return 'Rejected'
        
        if obj.hod_status == 'pending': return 'Stage 1: HOD'
        if obj.ict_status == 'pending': return 'Stage 2: ICT'
        if obj.sysadmin_status == 'pending': return 'Stage 3: System Admin'
        return 'Unknown'

    def get_days_open(self, obj):
        from django.utils import timezone
        delta = timezone.now() - obj.access_request.submitted_at
        return delta.days

    def get_is_overdue(self, obj):
        # Mark as overdue if pending for more than 3 days
        if self.get_current_stage(obj).startswith('Stage'):
            return self.get_days_open(obj) > 3
        return False

    def get_pending_approver(self, obj):
        stage = self.get_current_stage(obj)
        if stage == 'Stage 1: HOD':
            # Try to find HOD for the directorate
            request = obj.access_request
            if request.directorate:
                 # Check UserRole for HOD of this directorate
                 hod_role = UserRole.objects.filter(role='hod', directorate=request.directorate).first()
                 if hod_role: return f"{hod_role.user.full_name} (HOD)"
                 return f"HOD ({request.directorate.name})"
            return "Directorate HOD"
        elif stage == 'Stage 2: ICT':
            return "ICT Director"
        elif stage == 'Stage 3: System Admin':
            # Find Sys Admin for this system
            admin_role = UserRole.objects.filter(role='sys_admin', system_assigned=obj.system).first()
            if admin_role: return f"{admin_role.user.full_name} (Admin)"
            return "System Administrator"
        return "-"

class AccessRequestSerializer(serializers.ModelSerializer):
    requested_systems = RequestedSystemSerializer(many=True) # made writable (removed read_only=True)
    requester_details = CustomUserSerializer(source='requester', read_only=True)
    directorate_name = serializers.CharField(source='directorate.name', read_only=True)
    requester_name = serializers.CharField(source='requester.full_name', read_only=True)
    requester_email = serializers.CharField(source='requester.email', read_only=True)

    class Meta:
        model = AccessRequest
        fields = '__all__'
        extra_kwargs = {
            'requester': {'read_only': True} # requester is set in perform_create usually, but let's see
        }

    def create(self, validated_data):
        systems_data = validated_data.pop('requested_systems')
        # Assign requester from context if available, or expect it in data? 
        # Usually ViewSet passes user. 
        # But wait, AccessRequest model has 'requester' field. 
        # I'll rely on ViewSet perform_create to set requester, 
        # but here in create() I need to handle it if it's in validated_data.
        
        access_request = AccessRequest.objects.create(**validated_data)
        for system_data in systems_data:
            RequestedSystem.objects.create(access_request=access_request, **system_data)
        return access_request
class UserManagementSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='userrole.role', required=False)
    role_directorate = serializers.PrimaryKeyRelatedField(
        source='userrole.directorate', 
        queryset=Directorate.objects.all(), 
        required=False,
        allow_null=True
    )
    system_assigned = serializers.ChoiceField(
        source='userrole.system_assigned', 
        choices=RequestedSystem.SYSTEM_CHOICES, 
        required=False,
        allow_null=True
    )
    # Exposing directorate directly from CustomUser as well
    directorate_id = serializers.PrimaryKeyRelatedField(
        source='directorate',
        queryset=Directorate.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = CustomUser
        fields = ['id', 'tsc_no', 'full_name', 'email', 'is_active', 'directorate_id', 'role', 'role_directorate', 'system_assigned']
        extra_kwargs = {
            'tsc_no': {'validators': []}, # We handle unique manually or let DB raise
            'email': {'validators': []}
        }

    def create(self, validated_data):
        userrole_data = validated_data.pop('userrole', {})
        directorate = validated_data.pop('directorate', None)
        
        # Extract Role Data
        role = userrole_data.get('role', 'staff')
        role_directorate = userrole_data.get('directorate', None)
        system_assigned = userrole_data.get('system_assigned', None)

        # Create User
        # We need to set a default password or handle it. 
        # For now, let's set a default password.
        password = "Password123!" 
        
        user = CustomUser.objects.create(
            directorate=directorate, 
            **validated_data
        )
        user.set_password(password)
        user.save()

        # Create Role
        UserRole.objects.create(
            user=user,
            role=role,
            directorate=role_directorate,
            system_assigned=system_assigned
        )
        return user

    def update(self, instance, validated_data):
        userrole_data = validated_data.pop('userrole', {})
        
        # Update User Fields
        if 'directorate' in validated_data:
             instance.directorate = validated_data.pop('directorate')
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update Role
        if userrole_data:
            role_instance, created = UserRole.objects.get_or_create(user=instance)
            
            if 'role' in userrole_data:
                role_instance.role = userrole_data['role']
            
            if 'directorate' in userrole_data:
                role_instance.directorate = userrole_data['directorate']
            
            if 'system_assigned' in userrole_data:
                role_instance.system_assigned = userrole_data['system_assigned']
            
            role_instance.save()
            
        return instance

class UserManagementSerializerRead(CustomUserSerializer):
     # Just alias for clarity if needed, or we can use CustomUserSerializer for lists
     pass
