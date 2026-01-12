from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import AccessRequest, RequestedSystem, Directorate

class UserRightsTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(tsc_no="12345", email="test@test.com", password="pass")
        self.directorate = Directorate.objects.create(name="HR", hod_email="hod@hr.com")
        self.user.directorate = self.directorate
        self.user.save()

    def create_request(self, system_id, req_type, status='approved', decision_date=None):
        if decision_date is None:
            decision_date = timezone.now()
            
        ar = AccessRequest.objects.create(
            requester=self.user,
            tsc_no=self.user.tsc_no,
            email=self.user.email,
            request_type=req_type,
            status=status
        )
        rs = RequestedSystem.objects.create(
            access_request=ar,
            system=system_id,
            sysadmin_status=status,
            sysadmin_decision_date=decision_date
        )
        return rs

    def test_new_access(self):
        # User requests NEW access to System 1 -> Approved
        self.create_request('1', 'new')
        
        response = self.client.get('/api/users/my_systems/', HTTP_AUTHORIZATION=f'Token {self._get_token()}')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['system'], '1')

    def test_revoked_access(self):
        # User has access, then it is revoked
        t1 = timezone.now() - timezone.timedelta(days=10)
        t2 = timezone.now() - timezone.timedelta(days=1)
        
        self.create_request('1', 'new', decision_date=t1)
        self.create_request('1', 'deactivate', decision_date=t2)
        
        response = self.client.get('/api/users/my_systems/', HTTP_AUTHORIZATION=f'Token {self._get_token()}')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 0)

    def test_regranted_access(self):
        # New -> Deactivate -> New
        t1 = timezone.now() - timezone.timedelta(days=10)
        t2 = timezone.now() - timezone.timedelta(days=5)
        t3 = timezone.now()
        
        self.create_request('1', 'new', decision_date=t1)
        self.create_request('1', 'deactivate', decision_date=t2)
        self.create_request('1', 'new', decision_date=t3)
        
        response = self.client.get('/api/users/my_systems/', HTTP_AUTHORIZATION=f'Token {self._get_token()}')
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['system'], '1')

    def _get_token(self):
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=self.user)
        return token.key
