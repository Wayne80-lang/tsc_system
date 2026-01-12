import os
import django
import sys
from django.utils import timezone

# Setup Django environment
sys.path.append(r'c:\Users\ADMIN\Desktop\tsc_system\tsc_system_access')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tsc_system_access.settings')
django.setup()

from access_request.models import AuditLog, SecurityPolicy, GlobalSettings, CustomUser

def seed_data():
    print("Seeding database...")

    # 1. Security Policies
    policies = [
        {'key': 'mfa', 'name': 'Multi-Factor Authentication', 'description': 'Require all administrators to use 2FA for login access.', 'is_enabled': True},
        {'key': 'ip_whitelist', 'name': 'IP Whitelisting', 'description': 'Restrict system access to known corporate IP ranges only.', 'is_enabled': False},
        {'key': 'strong_password', 'name': 'Strong Password Policy', 'description': 'Enforce complexity requirements (12+ chars, symbols, mixed case).', 'is_enabled': True},
        {'key': 'session_timeout', 'name': 'Session Timeout', 'description': 'Automatically log out users after 15 minutes of inactivity.', 'is_enabled': True},
    ]

    for p in policies:
        obj, created = SecurityPolicy.objects.get_or_create(key=p['key'], defaults=p)
        if created:
            print(f"Created policy: {p['name']}")
        else:
            print(f"Policy exists: {p['name']}")

    # 2. Global Settings
    settings = [
        {'key': 'system_name', 'label': 'System Name', 'value': 'TSC System Access Portal', 'group': 'general', 'is_public': True},
        {'key': 'support_email', 'label': 'Support Email Address', 'value': 'support@tsc.go.ke', 'group': 'general', 'is_public': True},
        {'key': 'max_session_duration', 'label': 'Max Session Duration (Minutes)', 'value': '60', 'group': 'general', 'is_public': False},
        {'key': 'maintenance_mode', 'label': 'Maintenance Mode', 'value': 'false', 'group': 'maintenance', 'is_public': True},
    ]

    for s in settings:
        obj, created = GlobalSettings.objects.get_or_create(key=s['key'], defaults=s)
        if created:
            print(f"Created setting: {s['label']}")
        else:
            print(f"Setting exists: {s['label']}")

    # 3. Dummy Audit Logs (only if empty)
    if AuditLog.objects.count() == 0:
        admin_user = CustomUser.objects.filter(is_superuser=True).first()
        if not admin_user:
            print("No superuser found, skipping dummy logs.")
        else:
            AuditLog.objects.create(user=admin_user, action="System Initialization", target="Database", status="success", ip_address="127.0.0.1")
            AuditLog.objects.create(user=admin_user, action="Security Policy Update", target="MFA Policy", status="success", ip_address="127.0.0.1")
            print("Created dummy audit logs.")
    else:
        print("Audit logs already exist.")

    print("Seeding complete.")

if __name__ == "__main__":
    try:
        seed_data()
    except Exception as e:
        print(f"Error seeding data: {e}")
