from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core import mail
from .models import AccessRequest, RequestedSystem, Directorate, UserRole
from django.utils import timezone

User = get_user_model()

class EmailBundlingTest(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Create Directorate
        self.directorate = Directorate.objects.create(name="IT", hod_email="hod@example.com")
        
        # Create Users
        self.requester = User.objects.create_user(tsc_no="12345", email="req@example.com", full_name="Requester", password="pass")
        self.hod = User.objects.create_user(tsc_no="HOD01", email="hod@example.com", full_name="HOD User", password="pass")
        self.ict = User.objects.create_user(tsc_no="ICT01", email="ict@example.com", full_name="ICT User", password="pass")
        
        # Assign Roles
        UserRole.objects.update_or_create(user=self.hod, defaults={'role': 'hod', 'directorate': self.directorate})
        UserRole.objects.update_or_create(user=self.ict, defaults={'role': 'ict'})
        
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

    def test_hod_bundled_email(self):
        self.client.force_login(self.hod)
        
        # Approve System 1
        response = self.client.post(f'/access/hod/decision/{self.sys1.id}/', {'action': 'approve'})
        self.sys1.refresh_from_db()
        print(f"Sys1 Status: {self.sys1.hod_status}")
        self.assertEqual(self.sys1.hod_status, 'approved')
        
        # Approve System 2
        response = self.client.post(f'/access/hod/decision/{self.sys2.id}/', {'action': 'approve'})
        self.sys2.refresh_from_db()
        print(f"Sys2 Status: {self.sys2.hod_status}")
        self.assertEqual(self.sys2.hod_status, 'approved')
        
        # Check pending count
        pending_count = self.access_request.requested_systems.filter(hod_status='pending').count()
        print(f"Pending Count: {pending_count}")

        self.assertEqual(len(mail.outbox), 2, f"Should send 2 emails. Outbox: {len(mail.outbox)}")
        
        self.assertIn("New Approved Systems", mail.outbox[0].subject)
        self.assertIn("HOD Review Complete", mail.outbox[1].subject)

    def test_ict_bundled_email(self):
        # Setup: HOD approved both
        self.sys1.hod_status = 'approved'
        self.sys1.save()
        self.sys2.hod_status = 'approved'
        self.sys2.save()
        
        self.client.force_login(self.ict)
        
        # Approve System 1
        response = self.client.post(f'/access/ict/decision/{self.sys1.id}/', {'action': 'approve'})
        self.assertEqual(len(mail.outbox), 0, "Should not send email yet")
        
        # Approve System 2
        response = self.client.post(f'/access/ict/decision/{self.sys2.id}/', {'action': 'approve'})
        self.assertEqual(len(mail.outbox), 1, "Should send 1 email (Requester)")
        
        self.assertIn("ICT Review Complete", mail.outbox[0].subject)
