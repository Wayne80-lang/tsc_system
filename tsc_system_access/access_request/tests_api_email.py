from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.core import mail
from .models import AccessRequest, RequestedSystem, Directorate, UserRole
from rest_framework.authtoken.models import Token

User = get_user_model()

class ApiEmailBundlingTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create Directorate
        self.directorate = Directorate.objects.create(name="IT", hod_email="hod@example.com")
        
        # Create Users
        self.requester = User.objects.create_user(tsc_no="12345", email="req@example.com", full_name="Requester", password="pass")
        self.hod = User.objects.create_user(tsc_no="HOD01", email="hod@example.com", full_name="HOD User", password="pass")
        self.ict = User.objects.create_user(tsc_no="ICT01", email="ict@example.com", full_name="ICT User", password="pass")
        
        # Assign Roles
        UserRole.objects.update_or_create(user=self.hod, defaults={'role': 'hod', 'directorate': self.directorate})
        UserRole.objects.update_or_create(user=self.ict, defaults={'role': 'ict'})
        
        # Auth Tokens
        self.hod_token = Token.objects.create(user=self.hod)
        self.ict_token = Token.objects.create(user=self.ict)
        
        # Create Access Request with 2 Systems
        self.access_request = AccessRequest.objects.create(
            requester=self.requester,
            tsc_no=self.requester.tsc_no,
            email=self.requester.email,
            directorate=self.directorate,
            designation="Dev",
            request_type="new"
        )
        self.sys1 = RequestedSystem.objects.create(access_request=self.access_request, system='1', hod_status='pending', ict_status='pending')
        self.sys2 = RequestedSystem.objects.create(access_request=self.access_request, system='2', hod_status='pending', ict_status='pending')

    def test_hod_api_bundled_email(self):
        # Authenticate as HOD
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.hod_token.key)
        
        # Approve System 1
        url = f'/api/approvals/{self.access_request.id}/decide/'
        self.client.post(url, {'system_id': self.sys1.id, 'action': 'approve'})
        
        self.sys1.refresh_from_db()
        self.assertEqual(self.sys1.hod_status, 'approved')
        self.assertEqual(len(mail.outbox), 0, "Should NOT send email after first system (pending exists)")
        
        # Approve System 2 (Last one)
        self.client.post(url, {'system_id': self.sys2.id, 'action': 'approve'})
        
        self.sys2.refresh_from_db()
        self.assertEqual(self.sys2.hod_status, 'approved')
        
        self.assertEqual(len(mail.outbox), 2, "Should send 2 emails (ICT + Requester)")
        self.assertIn("New Approved Systems", mail.outbox[0].subject)
        self.assertIn("HOD Review Complete", mail.outbox[1].subject)

    def test_ict_api_bundled_email(self):
        # Pre-approve HOD
        self.sys1.hod_status = 'approved'
        self.sys1.save()
        self.sys2.hod_status = 'approved'
        self.sys2.save()
        
        # Authenticate as ICT
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.ict_token.key)
        url = f'/api/approvals/{self.access_request.id}/decide/'

        # Approve System 1
        self.client.post(url, {'system_id': self.sys1.id, 'action': 'approve'})
        self.assertEqual(len(mail.outbox), 0, "No email yet")
        
        # Approve System 2
        self.client.post(url, {'system_id': self.sys2.id, 'action': 'approve'})
        self.assertEqual(len(mail.outbox), 1, "Should send 1 email to Requester")
        self.assertIn("ICT Review Complete", mail.outbox[0].subject)
