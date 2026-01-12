import os
import django

os.environ['DB_NAME'] = 'tsc_access_db'
os.environ['DB_USER'] = 'root'
os.environ['DB_PASSWORD'] = '1234'
os.environ['DB_HOST'] = '127.0.0.1'
os.environ['DB_PORT'] = '3306'
os.environ['ALLOWED_HOSTS'] = '*'

from dotenv import load_dotenv
load_dotenv()

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tsc_system_access.settings")
django.setup()

from access_request.models import GlobalSettings
from django.conf import settings

print("--- SEEDING GLOBAL SETTINGS ---")

settings_data = [
    {'key': 'system_name', 'label': 'System Name', 'value': 'TSC System Access Portal', 'group': 'general', 'is_public': True},
    {'key': 'support_email', 'label': 'Support Email Address', 'value': 'support@tsc.go.ke', 'group': 'general', 'is_public': True},
    {'key': 'ict_email', 'label': 'ICT Team Email', 'value': getattr(settings, 'ICT_TEAM_EMAIL', ''), 'group': 'general', 'is_public': False},
    {'key': 'system_email', 'label': 'System Email (Outgoing)', 'value': getattr(settings, 'EMAIL_HOST_USER', ''), 'group': 'general', 'is_public': False},
    {'key': 'max_session_duration', 'label': 'Max Session Duration (Minutes)', 'value': '15', 'group': 'general', 'is_public': False},
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
]

for s in settings_data:
    obj, created = GlobalSettings.objects.update_or_create(
        key=s['key'],
        defaults=s
    )
    status = "CREATED" if created else "UPDATED"
    print(f"[{status}] {s['label']}: {s['value']}")

print("------------------------")
