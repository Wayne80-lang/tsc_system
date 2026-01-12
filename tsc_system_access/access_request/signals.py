from django.db.models.signals import post_save
from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.dispatch import receiver
from .models import AccessRequest, RequestedSystem, AuditLog
from django.utils import timezone

# 1. Log User Login
@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    try:
        ip = request.META.get('REMOTE_ADDR') if request else 'Unknown'
        AuditLog.objects.create(
            user=user,
            action="User Login",
            target="Session",
            ip_address=ip,
            status="success"
        )
    except Exception as e:
        print(f"Error logging login: {e}")

# 2. Log Failed Login
# 2. Log Failed Login
@receiver(user_login_failed)
def log_user_login_failed(sender, credentials, request, **kwargs):
    try:
        ip = request.META.get('REMOTE_ADDR') if request else 'Unknown'
        # Credentials usually come as {'username': '...', 'password': '...'}
        # even if the field is tsc_no, the key in auth payload is often 'username'
        tsc_input = credentials.get('username') or credentials.get('tsc_no') or 'Unknown'
        
        # Check if user exists
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user_exists = User.objects.filter(tsc_no=tsc_input).exists()

        if user_exists:
            action_text = f"Failed Login Attempt (TSC: {tsc_input})"
            status_text = "failure"
        else:
            action_text = f"Login Attempt with Invalid TSC ({tsc_input})"
            status_text = "warning"
        
        # Create a log with no user, but meaningful info
        AuditLog.objects.create(
            user=None, 
            action=action_text,
            target="Authentication",
            ip_address=ip,
            status=status_text
        )
    except Exception as e:
        print(f"Error logging failed login: {e}")

# 3. Log New Request Creation
@receiver(post_save, sender=AccessRequest)
def log_new_request(sender, instance, created, **kwargs):
    if created:
        AuditLog.objects.create(
            user=instance.requester,
            action="Submitted Access Request",
            target=f"REQ-{instance.id}",
            status="success"
        )

# 4. Log System Status Changes (Approvals/Rejections)
# We use pre_save or we check against previous version?
# Since we don't easily have 'previous' in post_save without dirty tracking, 
# we can assume if decision_date changed, an action happened.
# OR we can just log every save if status is not pending? 
# Better: In `api_views.py` we explicitly set statuses. 
# BUT, using signals is cleaner if it works. 
# Let's use the explicit logging in Views for complex logic, OR 
# hook into the model save. 
# A simple way for MVP: Just log whenever status corresponds to a "decision".

@receiver(post_save, sender=RequestedSystem)
def log_system_update(sender, instance, created, **kwargs):
    if created:
        # Log when a specific system is requested
        AuditLog.objects.create(
            user=instance.access_request.requester,
            action="Requested Access",
            target=f"{instance.get_system_display()} (REQ-{instance.access_request.id})",
            status="success"
        )
    return