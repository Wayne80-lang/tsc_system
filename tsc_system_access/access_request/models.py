from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

class Directorate(models.Model):
    name = models.CharField(max_length=100, unique=True)
    hod_email = models.EmailField()

    def __str__(self):
        return self.name

class AccessRequest(models.Model):
    REQUEST_TYPE_CHOICES = [('new', 'New User'), ('modify', 'Change/Modify'), ('deactivate', 'Deactivate')]
    STATUS_CHOICES = [
        ('pending_hod', 'Pending HOD'), ('rejected_hod', 'Rejected HOD'),
        ('pending_ict', 'Pending ICT'), ('rejected_ict', 'Rejected ICT'),
        ('approved', 'Approved'), ('revoked', 'Access Revoked')
    ]
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    tsc_no = models.CharField(max_length=20)
    email = models.EmailField()
    directorate = models.ForeignKey(Directorate, on_delete=models.SET_NULL, null=True)
    designation = models.CharField(max_length=100)
    request_type = models.CharField(max_length=20, choices=REQUEST_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_hod')
    submitted_at = models.DateTimeField(auto_now_add=True)
    hod_approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="hod_approvals")
    ict_approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="ict_approvals")

    def __str__(self):
        return f"{self.requester.full_name} - {self.request_type}"

class RequestedSystem(models.Model):
    SYSTEM_CHOICES = [
        ('1', 'Active Directory'), ('2', 'CRM'), ('3', 'EDMS'), ('4', 'Email'),
        ('5', 'Help Desk'), ('6', 'HRMIS'), ('7', 'IDEA'), ('8', 'IFMIS'),
        ('9', 'Knowledge Base'), ('10', 'Services'), ('11', 'Teachers Online'),
        ('12', 'TeamMate'), ('13', 'TPAD'), ('14', 'TPAY'), ('15', 'Pydio')
    ]
    access_request = models.ForeignKey(AccessRequest, on_delete=models.CASCADE, related_name="requested_systems")
    system = models.CharField(max_length=20, choices=SYSTEM_CHOICES)
    level_of_access = models.CharField(max_length=50, blank=True, null=True)
    
    hod_status = models.CharField(max_length=10, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending')
    hod_decision_date = models.DateTimeField(blank=True, null=True)
    hod_comment = models.TextField(blank=True, null=True)

    ict_status = models.CharField(max_length=10, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('sent_admin', 'Sent to Admin')], default='pending')
    ict_decision_date = models.DateTimeField(blank=True, null=True)
    ict_comment = models.TextField(blank=True, null=True)

    system_admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_systems')
    sysadmin_status = models.CharField(max_length=10, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('revoked', 'Revoked')], default='pending')
    sysadmin_comment = models.TextField(blank=True, null=True)
    sysadmin_decision_date = models.DateTimeField(blank=True, null=True)
    directorate = models.ForeignKey(Directorate, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.get_system_display()} ({self.access_request.tsc_no})"

class SystemAnalytics(AccessRequest):
    class Meta:
        proxy = True
        verbose_name = "📊 System Dashboard"
        verbose_name_plural = "📊 System Dashboard"

class AccessLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    action = models.CharField(max_length=50, default="Login")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "User Access Log"
        verbose_name_plural = "User Access Logs"

    def __str__(self):
        return f"{self.user.full_name} ({self.action})"

class CustomUserManager(BaseUserManager):
    def create_user(self, tsc_no, password=None, **extra_fields):
        if not tsc_no: raise ValueError("TSC Number is required")
        user = self.model(tsc_no=tsc_no, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    def create_superuser(self, tsc_no, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(tsc_no, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    tsc_no = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True, null=True, blank=True)
    directorate = models.ForeignKey(Directorate, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    USERNAME_FIELD = 'tsc_no'
    REQUIRED_FIELDS = ['full_name', 'email']
    objects = CustomUserManager()
    def __str__(self): return f"{self.full_name} ({self.tsc_no})"
    def get_full_name(self): return self.full_name
    def get_short_name(self): return self.full_name.split(" ")[0] if self.full_name else self.full_name

class UserRole(models.Model):
    ROLE_CHOICES = [('hod', 'HOD'), ('ict', 'ICT'), ('staff', 'Staff'), ('sys_admin', 'System Admin'), ('super_admin', 'Overall Admin')]
    user = models.OneToOneField("access_request.CustomUser", on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')
    hod = models.ForeignKey("access_request.CustomUser", on_delete=models.SET_NULL, null=True, blank=True, related_name="staff_members_under_me")
    def __str__(self): return f"{self.user.full_name} - {self.role}"

class SystemAdminAssignment(models.Model):
    system = models.CharField(max_length=20, choices=RequestedSystem.SYSTEM_CHOICES, unique=True)
    admin_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="system_admin_roles")
    admin_email = models.EmailField(blank=True, null=True)
    def __str__(self): return f"{self.get_system_display()} -> {self.admin_user}"

class SystemAdmin(models.Model):
     user = models.OneToOneField("access_request.CustomUser", on_delete=models.CASCADE)
     system = models.CharField(max_length=20, choices=RequestedSystem.SYSTEM_CHOICES, unique=True)
     def __str__(self): return f"{self.user.full_name} - {self.get_system_display()}"

class HodAssignment(models.Model):
    directorate = models.OneToOneField(Directorate, on_delete=models.CASCADE, related_name='hod_assignment')
    hod_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='hod_roles')
    hod_email = models.EmailField(blank=True, null=True)
    def __str__(self): return f"{self.directorate.name} -> {self.hod_user}"

class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=UserRole.ROLE_CHOICES, default='staff')
    directorate = models.ForeignKey('Directorate', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    hod = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="staff_members")
    system_assigned = models.CharField(max_length=20, choices=RequestedSystem.SYSTEM_CHOICES, blank=True, null=True)
    def __str__(self): return f"{self.user.full_name}"