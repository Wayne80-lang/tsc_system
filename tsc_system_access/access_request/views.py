from datetime import date, datetime
import io
import os
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from .models import AccessRequest, RequestedSystem, SystemAdmin, SystemAdminAssignment,UserRole
from .forms import AccessRequestForm
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.contrib import messages
from django.views.decorators.http import require_POST
from django.shortcuts import get_object_or_404
from django.core.mail import EmailMessage
from django.utils.timezone import now, localdate
from django.http import HttpResponse
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from django.utils.timezone import localdate
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet
from django.templatetags.static import static
from .models import RequestedSystem
import csv
from io import BytesIO
from datetime import date
from django.db.models import Q



@login_required
def request_form_view(request):
    if request.method == 'POST':
        form = AccessRequestForm(request.POST)
        if form.is_valid():
            access = form.save(commit=False)
            access.requester = request.user
            access.tsc_no = request.user.tsc_no
            access.email = request.user.email
            access.directorate = request.user.directorate  # ✅ set from logged-in user
            
            access.save()
        

            hod_email = access.directorate.hod_email

            # ✅ EMAIL: Send to HOD
            send_mail(
                subject='[TSC] New System Access Request Awaiting Your Approval',
                message=f"A new access request from {request.user.get_full_name()} ({request.user.email}) has been submitted for your review.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[hod_email],
            )

            # ✅ EMAIL: Send Acknowledgment to requester
            send_mail(
                subject='[TSC] Your System Access Request Has Been Submitted',
                message=f"Hi {request.user.get_full_name()},\n\nYour system access request has been successfully submitted and is pending approval from the HOD.\n\nRegards,\nICT Team",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[form.cleaned_data['email']],
            )

            return redirect('request_submitted')  # create a thank you page or route
    else:
        form = AccessRequestForm(initial={
            'tsc_no': request.user.tsc_no,
            'email': request.user.email,
            'designation': getattr(request.user, 'designation', '')        })

    return render(request, 'access_request/request_form.html', {'form': form})

@login_required
def hod_dashboard(request):
    """HOD dashboard fetching requests per system from RequestedSystem."""
    user = request.user

    # 1️⃣ Get HOD's directorate
    try:
        directorate = user.directorate  # or user.profile.directorate depending on your setup
    except AttributeError:
        messages.error(request, "No directorate found for your account.")
        directorate = None

    # 2️⃣ Fetch all requests visible to this HOD
    if directorate:
        requests = RequestedSystem.objects.filter(
            access_request__directorate=directorate
        ).select_related("access_request", "access_request__requester")
    else:
        requests = RequestedSystem.objects.none()

    # 🧪 Temporary debug info in logs
    print(f"[DEBUG] HOD: {user.full_name} | Directorate: {directorate}")
    print(f"[DEBUG] Found {requests.count()} requests for this HOD")

    context = {
        "requests": requests,
        "hod_directorate": directorate,
        "user": user,
    }
    return render(request, "access_request/hod_dashboard.html", context)


@login_required
def ict_dashboard(request):
    requests = AccessRequest.objects.filter(
        requested_systems__hod_status="approved",
        requested_systems__ict_status="pending"
    ).distinct()
    return render(request, "access_request/ict_dashboard.html", {"requests": requests})


def request_submitted(request):
    return render(request, 'access_request/request_submitted.html')


def approve_request(request, request_id):
    access = AccessRequest.objects.get(id=request_id)
    access.hod_status = 'approved'
    access.status = 'pending_ict'
    access.hod_decision_date = timezone.now()
    access.save()

    # Send email to requester
    send_mail(
        subject='[TSC] Your Access Request Has Been Approved',
        message='Dear {}, your access request has been approved by the HOD.'.format(access.email),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[access.email],
    )

    return redirect('hod_dashboard')

def reject_request(request, request_id):
    if request.method == 'POST':
        comment = request.POST.get('hod_comment')
        access = AccessRequest.objects.get(id=request_id)
        access.hod_status = 'rejected'
        access.hod_comment = comment
        access.hod_decision_date = timezone.now()
        access.save()

        # Send rejection email with comment
        send_mail(
            subject='[TSC] Your Access Request Has Been Rejected',
            message=f'Dear {access.email}, your request was rejected by the HOD.\n\nComment: {comment}',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[access.email],
        )

    return redirect('hod_dashboard')

@login_required
def user_home(request):
    requests = AccessRequest.objects.filter(requester=request.user).prefetch_related("requested_systems")
    return render(request, "access_request/user_home.html", {"requests": requests})



    


#ict




@require_POST
def ict_approve(request, pk):
    system_request = get_object_or_404(RequestedSystem, pk=pk)
    system_request.ict_status = 'sent_admin'
    system_request.save()

    # ✅ Find matching system admin
    try:
        assignment = SystemAdminAssignment.objects.get(system=system_request.system)
        admin_email = assignment.admin_email or assignment.admin_user.email

        # Notify the system admin
        send_mail(
            subject=f"[TSC] Approval Required – {system_request.get_system_display()}",
            message=(
                f"A new access request for {system_request.get_system_display()} "
                f"has been approved by ICT and awaits your final approval.\n\n"
                f"Staff: {system_request.access_request.requester.full_name}\n"
                f"TSC No: {system_request.access_request.tsc_no}\n\n"
                f"Please assign and after log into your dashboard to indicate completion of request."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
        )
    except SystemAdminAssignment.DoesNotExist:
        # If no admin assigned for that system, keep it in ICT status
        system_request.ict_status = 'approved'
        system_request.save()

    messages.success(request, "Request routed to System Admin (if assigned).")
    return redirect('ict_dashboard')

@require_POST
def ict_reject(request, pk):
    req = get_object_or_404(AccessRequest, pk=pk)
    comment = request.POST.get('comment')
    req.status = 'rejected'
    req.ict_comment = comment
    req.ict_decision_date = timezone.now()
    req.save()

    send_mail(
        subject="Your Access Request Was Rejected by ICT",
        message=f"Hello {req.requester.get_full_name()},\n\nYour access request was rejected by ICT.\nReason: {comment}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[req.email],
    )

    messages.warning(request, "Request rejected and email sent.")
    return redirect('ict_dashboard')

@login_required
def home_redirect(request):
    profile = getattr(request.user, "profile", None)
    if not profile:
        return redirect("user_home")

    role_map = {
        "staff": "user_home",
        "hod": "hod_dashboard",
        "ict": "ict_dashboard",
        "sys_admin": "system_admin_dashboard",
        "super_admin": "super_admin_dashboard",
    }

    return redirect(role_map.get(profile.role, "user_home"))






@login_required
def submit_request(request):
    if request.method == 'POST':
        form = AccessRequestForm(request.POST)
        if form.is_valid():
            access = form.save(commit=False)
            access.requester = request.user
            access.tsc_no = request.user.tsc_no
            access.email = request.user.email
            access.directorate = request.user.directorate
            access.save()

            for system in form.cleaned_data['systems']:
             RequestedSystem.objects.create(
             access_request=access,
             system=system,
             level_of_access=form.cleaned_data.get('access_levels', 'User')
            )

            # ✅ Get HOD email from directorate
            if access.directorate and access.directorate.hod_email:
                hod_email = access.directorate.hod_email
                send_mail(
                    subject='[TSC] New System Access Request Awaiting Your Approval',
                    message=f"A new access request from {request.user.full_name} ({request.user.email}) has been submitted for your review.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[hod_email],
                )

            # ✅ Acknowledgment email to staff
            send_mail(
                subject='[TSC] Your System Access Request Has Been Submitted',
                message=f"Hi {request.user.full_name},\n\nYour request has been successfully submitted and sent to your HOD for approval.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[request.user.email],
            )

            return redirect('request_submitted')
    else:
        form = AccessRequestForm(initial={
            'tsc_no': request.user.tsc_no,
            'email': request.user.email,
            'directorate': request.user.directorate
        })
    return render(request, 'access_request/request_form.html', {'form': form})








@login_required
def hod_system_decision(request, system_id):
    # role guard: only HODs may access
    if not getattr(request.user, "userrole", None) or request.user.userrole.role != "hod":
        return HttpResponse(status=403)

    system = get_object_or_404(RequestedSystem, id=system_id)

    # scope guard: only HOD for the requester may act
    if not UserRole.objects.filter(hod=request.user, user=system.access_request.requester, role="staff").exists():
        return HttpResponse(status=403)

    if request.method == "POST":
        action = request.POST.get("action")
        comment = request.POST.get("comment", "")

        if action == "approve":
            system.hod_status = "approved"
            system.hod_comment = ""
            system.save()

        elif action == "reject":
            system.hod_status = "rejected"
            system.hod_comment = comment
            system.save()

        # ✅ After every action → check if all systems are processed
        request_obj = system.access_request
        pending = request_obj.requested_systems.filter(hod_status="pending").exists()

        if not pending:
            approved_systems = request_obj.requested_systems.filter(hod_status="approved")
            rejected_systems = request_obj.requested_systems.filter(hod_status="rejected")

            approved_list = ", ".join([s.get_system_display() for s in approved_systems]) or "None"
            rejected_list = "\n".join(
                [f"{s.get_system_display()} → {s.hod_comment or 'No reason provided'}" for s in rejected_systems]
            ) or "None"

            # ✅ Consolidated email to ICT
            send_mail(
                subject="[TSC] New Access Request (HOD Review Completed)",
                message=(
                    f"Staff {request_obj.requester.full_name} ({request_obj.tsc_no}) has completed HOD review.\n\n"
                    f"✅ Approved systems: {approved_list}\n\n"
                    f"❌ Rejected systems:\n{rejected_list}\n\n"
                    "Please log in to ICT Dashboard to process approved systems."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.ICT_TEAM_EMAIL],
            )

            # ✅ Consolidated email to Staff
            send_mail(
                subject="[TSC] Your Access Request – HOD Review Completed",
                message=(
                    f"Dear {request_obj.requester.full_name},\n\n"
                    f"Your system access request has been reviewed by your HOD.\n\n"
                    f"✅ Approved systems: {approved_list}\n\n"
                    f"❌ Rejected systems:\n{rejected_list}\n\n"
                    "Next step: If approved, your request will now move to ICT for final approval."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[request_obj.email],
            )

            # ✅ Update AccessRequest status
            if approved_systems.exists():
                request_obj.status = "pending_ict"
            else:
                request_obj.status = "rejected_hod"
            request_obj.save()

        return redirect("hod_dashboard")






@login_required
def ict_system_decision(request, system_id):
    # role guard: only ICT may access
    if not getattr(request.user, "userrole", None) or request.user.userrole.role != "ict":
        return HttpResponse(status=403)

    system = get_object_or_404(RequestedSystem, id=system_id)

    if request.method == "POST":
        action = request.POST.get("action")
        comment = request.POST.get("comment", "")

        if action == "approve":
            system.ict_status = "approved"
            system.ict_comment = ""
            system.save()
            messages.success(request, f"{system.get_system_display()} approved and email sent.")

        elif action == "reject":
            system.ict_status = "rejected"
            system.ict_comment = comment
            system.save()
            messages.warning(request, f"{system.get_system_display()} rejected. Email sent with reason.")

        # ✅ After every ICT action → check if all systems processed
        request_obj = system.access_request
        pending = request_obj.requested_systems.filter(ict_status="pending", hod_status="approved").exists()

        if not pending:  
            approved_systems = request_obj.requested_systems.filter(ict_status="approved", hod_status="approved")
            rejected_systems = request_obj.requested_systems.filter(ict_status="rejected", hod_status="approved")

            approved_list = ", ".join([s.get_system_display() for s in approved_systems]) or "None"
            rejected_list = "\n".join(
                [f"{s.get_system_display()} → {s.ict_comment or 'No reason provided'}" for s in rejected_systems]
            ) or "None"

            # ✅ Use EmailMessage for CC
            subject = "[TSC] Your Access Request – ICT Review Completed"
            body = (
                f"Dear {request_obj.requester.full_name},\n\n"
                f"Your system access request has now been reviewed by ICT.\n\n"
                f"✅ Approved systems: {approved_list}\n\n"
                f"❌ Rejected systems:\n{rejected_list}\n\n"
                "Awaiting assignment of rights by admin. Please contact ICT if further clarification is needed."
            )

            email = EmailMessage(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[request_obj.email],  # staff
                cc=[request_obj.directorate.hod_email],  # ✅ HOD is CC’d
            )
            email.send()

            # ✅ Update AccessRequest status
            if approved_systems.exists():
                request_obj.status = "approved"
            else:
                request_obj.status = "rejected_ict"
            request_obj.save()

        return redirect("ict_dashboard")



#system administrators




@login_required
def system_admin_dashboard(request):
    """Dashboard for system administrators with filters and stats."""
    
    system_admin, created = SystemAdmin.objects.get_or_create(user=request.user)

    # ✅ Use the correct system field from your model
    system_requests = RequestedSystem.objects.filter(
        system=system_admin.system
    ).select_related("access_request")

    # 🧾 Filters
    # Default to pending so processed items drop out of the queue by default
    status_filter = request.GET.get("status", "pending")
    date_filter = request.GET.get("date", "")

    if status_filter != "all":
        system_requests = system_requests.filter(sysadmin_status=status_filter)  # ✅ fixed

    if date_filter:
        try:
            selected_date = datetime.strptime(date_filter, "%Y-%m-%d").date()
            system_requests = system_requests.filter(
                access_request__submitted_at__date=selected_date
            )
        except ValueError:
            pass  # ignore invalid dates

    # 🧩 Summary counts
    total_requests = system_requests.count()
    pending_requests = RequestedSystem.objects.filter(
        system=system_admin.system, sysadmin_status="pending"
    ).count()
    approved_requests = RequestedSystem.objects.filter(
        system=system_admin.system, sysadmin_status="approved"
    ).count()
    rejected_requests = RequestedSystem.objects.filter(
        system=system_admin.system, sysadmin_status="rejected"
    ).count()
    today_requests = RequestedSystem.objects.filter(
        system=system_admin.system, access_request__submitted_at__date=date.today()
    ).count()

    context = {
        "system_name": dict(RequestedSystem.SYSTEM_CHOICES).get(system_admin.system),
        "requests": system_requests,
        "total_requests": total_requests,
        "pending_requests": pending_requests,
        "approved_requests": approved_requests,
        "rejected_requests": rejected_requests,
        "today_requests": today_requests,
        "status_filter": status_filter,
        "date_filter": date_filter,
    }

    return render(request, "access_request/system_admin_dashboard.html", context)




@require_POST
@login_required
def system_admin_decision(request, pk):
    """System admin approves or rejects a request"""
    # role guard: must be a SystemAdmin user
    if not SystemAdmin.objects.filter(user=request.user).exists():
        return HttpResponse(status=403)

    sys_req = get_object_or_404(RequestedSystem, pk=pk)

    # scope guard: must match this admin's system
    if not SystemAdmin.objects.filter(user=request.user, system=sys_req.system).exists():
        return HttpResponse(status=403)
    action = request.POST.get("action")
    comment = request.POST.get("comment", "")

    if action == "approve":
        # update sysadmin decision fields and mirror final ICT state for reporting
        sys_req.sysadmin_status = "approved"
        sys_req.sysadmin_comment = ""
        sys_req.ict_status = "approved"
        message_text = f"Rights have been granted for {sys_req.get_system_display()}."
    elif action == "reject":
        sys_req.sysadmin_status = "rejected"
        sys_req.sysadmin_comment = comment
        sys_req.ict_status = "rejected"
        message_text = f" Request for {sys_req.get_system_display()} was rejected. Reason: {comment}"
    else:
        messages.error(request, "Invalid action.")
        return redirect('system_admin_dashboard')

    sys_req.sysadmin_decision_date = timezone.now()
    sys_req.save()

    # Send email to user, CC HOD
    requester = sys_req.access_request.requester
    hod_email = sys_req.access_request.directorate.hod_email

    send_mail(
        subject=f"[TSC] Access Update for {sys_req.get_system_display()}",
        message=f"Dear {requester.full_name},\n\n{message_text}\n\nRegards,\nTSC ICT Team",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[requester.email],
        fail_silently=True,
    )

    messages.success(request, "Decision saved and email sent.")
    return redirect('system_admin_dashboard')



@login_required
def overall_admin_dashboard(request):
    # restrict to overall admin (or superuser)
    try:
        role = request.user.userrole.role
    except UserRole.DoesNotExist:
        role = 'staff'
    if not (role == 'super_admin' or request.user.is_superuser):
        return HttpResponse(status=403)
    status_filter = request.GET.get("status", "")
    system_filter = request.GET.get("system", "")
    date_filter = request.GET.get("date", "")
    today_filter = request.GET.get("today", "")

    requests = RequestedSystem.objects.select_related("access_request", "access_request__requester")

    if status_filter:
        requests = requests.filter(ict_status=status_filter)
    if system_filter:
        requests = requests.filter(system=system_filter)
    if date_filter:
        requests = requests.filter(access_request__submitted_at__date=date_filter)
    if today_filter:
        requests = requests.filter(access_request__submitted_at__date=localdate())

    total = RequestedSystem.objects.count()
    pending = RequestedSystem.objects.filter(ict_status="sent_admin").count()
    approved = RequestedSystem.objects.filter(ict_status="approved").count()
    rejected = RequestedSystem.objects.filter(ict_status="rejected").count()

    # ✅ Export to Excel
    if "export_excel" in request.GET:
        wb = Workbook()
        ws = wb.active
        ws.title = "System Access Requests"

        headers = ["Requester", "TSC No", "System", "Request Type", "Status", "Submitted At"]
        ws.append(headers)

        for sys in requests:
            ws.append([
                sys.access_request.requester.full_name,
                sys.access_request.tsc_no,
                sys.get_system_display(),
                sys.access_request.get_request_type_display(),
                sys.ict_status.capitalize(),
                sys.access_request.submitted_at.strftime("%Y-%m-%d %H:%M"),
            ])

        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="TSC_Requests_{localdate()}.xlsx"'
        wb.save(response)
        return response

    # ✅ Export to PDF
    if "export_pdf" in request.GET:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
        elements = []

        styles = getSampleStyleSheet()
        title_style = styles["Title"]
        title_style.textColor = colors.HexColor("#001F54")
        subtitle_style = styles["Normal"]
        subtitle_style.textColor = colors.HexColor("#001F54")

        logo_path = os.path.join(settings.BASE_DIR, 'static/images/tsc_logo.jpeg')
        header_row = []
        if os.path.exists(logo_path):
            header_row = [[Image(logo_path, width=48, height=68), Paragraph("<b>Teachers Service Commission</b><br/><font size=9>ICT System Access Requests</font>", subtitle_style)]]
            header_tbl = Table(header_row, colWidths=[52, 450])
            header_tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ]))
            elements.append(header_tbl)
        else:
            elements.append(Paragraph("<b>Teachers Service Commission</b>", title_style))

        elements.append(Spacer(1, 6))
        # brand divider
        divider = Table([[" "]], colWidths=[502])
        divider.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFD700')),
            ('LINEBELOW', (0, 0), (-1, -1), 1, colors.HexColor('#001F54')),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(divider)
        elements.append(Spacer(1, 10))

        elements.append(Paragraph("TSC System Access Request Report", title_style))
        elements.append(Spacer(1, 8))
        elements.append(Paragraph("Generated on: " + localdate().strftime("%Y-%m-%d"), styles["Italic"]))
        elements.append(Spacer(1, 12))

        # Table Header
        data = [["Requester", "TSC No", "System", "Type", "Status", "Date"]]

        for sys in requests:
            data.append([
                sys.access_request.requester.full_name,
                sys.access_request.tsc_no,
                sys.get_system_display(),
                sys.access_request.get_request_type_display(),
                sys.ict_status.capitalize(),
                sys.access_request.submitted_at.strftime("%Y-%m-%d"),
            ])

        table = Table(data, repeatRows=1, colWidths=[120, 60, 110, 80, 60, 72])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#001F54")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#9aa0a6')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.HexColor('#f1f3f4')]),
        ]))

        elements.append(table)
        elements.append(Spacer(1, 10))
        footer_note = Paragraph("Teachers Service Commission • ICT Directorate", subtitle_style)
        elements.append(footer_note)
        doc.build(elements)

        buffer.seek(0)
        return HttpResponse(buffer, content_type="application/pdf")

    return render(request, "access_request/overall_admin_dashboard.html", {
        "requests": requests,
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "system_choices": RequestedSystem.SYSTEM_CHOICES,
    })



@login_required
def export_system_admin_data(request, format):
    """Export system admin request data in CSV or PDF."""
    # role guard: must be a SystemAdmin user
    try:
        system_admin = SystemAdmin.objects.get(user=request.user)
    except SystemAdmin.DoesNotExist:
        messages.error(request, "You are not assigned as a system admin.")
        return redirect("home")

    requests = RequestedSystem.objects.filter(system=system_admin.system).select_related('access_request')

    if format == "csv":
        response = HttpResponse(content_type="text/csv")
        response['Content-Disposition'] = f'attachment; filename="{system_admin.system}_requests.csv"'
        writer = csv.writer(response)
        writer.writerow(["Requester", "TSC No", "Request Type", "Access Level", "Status", "Date"])

        for r in requests:
            writer.writerow([
                r.access_request.requester.full_name,
                r.access_request.tsc_no,
                r.access_request.get_request_type_display(),
                r.level_of_access,
                r.sysadmin_status,
                r.access_request.submitted_at.strftime("%Y-%m-%d %H:%M"),
            ])
        return response

    elif format == "pdf":
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=landscape(A4))

        # Brand header bar
        p.setFillColor(colors.HexColor('#001F54'))
        p.rect(0, 560, 842, 40, fill=1, stroke=0)
        p.setFillColor(colors.HexColor('#FFD700'))
        p.setFont("Helvetica-Bold", 16)
        p.drawString(60, 570, "Teachers Service Commission")
        p.setFont("Helvetica", 10)
        p.drawString(60, 556, "ICT System Access – System Admin Report")

        # Logo (if exists)
        logo_path = os.path.join(settings.BASE_DIR, 'static/images/tsc_logo.jpeg')
        if os.path.exists(logo_path):
            try:
                p.drawImage(logo_path, 20, 562, width=32, height=32, preserveAspectRatio=True, mask='auto')
            except Exception:
                pass

        # Table header
        y = 520
        headers = ["Requester", "TSC No", "Request Type", "Access Level", "Status", "Date"]
        col_x = [40, 190, 300, 430, 560, 660]
        p.setFillColor(colors.HexColor('#001F54'))
        p.rect(30, y - 4, 782, 22, fill=1, stroke=0)
        p.setFillColor(colors.whitesmoke)
        p.setFont("Helvetica-Bold", 11)
        for i, header in enumerate(headers):
            p.drawString(col_x[i], y, header)
        y -= 26

        # Rows
        p.setFont("Helvetica", 10)
        row_bg = [colors.whitesmoke, colors.HexColor('#f1f3f4')]
        row_idx = 0
        for r in requests:
            if y < 50:
                p.showPage()
                # redraw header bar on new page
                p.setFillColor(colors.HexColor('#001F54'))
                p.rect(0, 560, 842, 40, fill=1, stroke=0)
                p.setFillColor(colors.HexColor('#FFD700'))
                p.setFont("Helvetica-Bold", 16)
                p.drawString(60, 570, "Teachers Service Commission")
                p.setFont("Helvetica", 10)
                p.drawString(60, 556, "ICT System Access – System Admin Report")
                y = 520
                p.setFillColor(colors.HexColor('#001F54'))
                p.rect(30, y - 4, 782, 22, fill=1, stroke=0)
                p.setFillColor(colors.whitesmoke)
                p.setFont("Helvetica-Bold", 11)
                for i, header in enumerate(headers):
                    p.drawString(col_x[i], y, header)
                y -= 26

            # row background
            p.setFillColor(row_bg[row_idx % 2])
            p.rect(30, y - 2, 782, 18, fill=1, stroke=0)
            p.setFillColor(colors.black)
            row_idx += 1

            row = [
                r.access_request.requester.full_name,
                r.access_request.tsc_no,
                r.access_request.get_request_type_display(),
                r.level_of_access,
                r.sysadmin_status,
                r.access_request.submitted_at.strftime("%Y-%m-%d"),
            ]
            for i, col in enumerate(row):
                p.drawString(col_x[i], y, str(col))
            y -= 20

        p.showPage()
        p.save()
        pdf = buffer.getvalue()
        buffer.close()
        response = HttpResponse(content_type='application/pdf')
        response["Content-Disposition"] = f'attachment; filename="TSC_Requests_{localdate()}.xlsx"'
        response.write(pdf)
        return response

    else:
        messages.error(request, "Invalid export format.")
        return redirect("system_admin_dashboard")
