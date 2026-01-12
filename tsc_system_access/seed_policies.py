import os
import django

os.environ['DB_NAME'] = 'tsc_access_db'
os.environ['DB_USER'] = 'root'
os.environ['DB_PASSWORD'] = '1234'
os.environ['DB_HOST'] = '127.0.0.1'
os.environ['DB_PORT'] = '3306'

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tsc_system_access.settings")
django.setup()

from access_request.models import SecurityPolicy

DEFAULT_POLICIES = [
    {'key': 'mfa', 'name': 'Multi-Factor Authentication', 'description': 'Require all administrators to use 2FA for login access.'},
    {'key': 'ip_whitelist', 'name': 'IP Whitelisting', 'description': 'Restrict system access to known corporate IP ranges only.'},
    {'key': 'strong_password', 'name': 'Strong Password Policy', 'description': 'Enforce complexity requirements (12+ chars, symbols, mixed case).'},
    {'key': 'session_timeout', 'name': 'Session Timeout', 'description': 'Automatically log out users after 15 minutes of inactivity.'},
]

print("--- SEEDING POLICIES ---")
for p_data in DEFAULT_POLICIES:
    policy, created = SecurityPolicy.objects.get_or_create(
        key=p_data['key'],
        defaults={
            'name': p_data['name'],
            'description': p_data['description'],
            'is_enabled': False
        }
    )
    if created:
        print(f"[CREATED] {policy.name} (ID: {policy.id})")
    else:
        print(f"[EXISTS] {policy.name} (ID: {policy.id})")

print("------------------------")
