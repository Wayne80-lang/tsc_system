from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django import forms
from .models import (
    CustomUser, UserRole, Directorate, 
    SystemAdmin, RequestedSystem, HodAssignment, SystemAdminAssignment
)

# --- 1. Directorate Admin ---
@admin.register(Directorate)
class DirectorateAdmin(admin.ModelAdmin):
    list_display = ['name', 'hod_email']
    search_fields = ['name', 'hod_email']

# --- 2. Custom User Admin ---
class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ("tsc_no", "full_name", "email", "directorate", "is_staff", "is_active")
    list_filter = ("is_staff", "is_active", "directorate")
    search_fields = ("tsc_no", "full_name", "email")
    ordering = ("tsc_no",)

    fieldsets = (
        (None, {"fields": ("tsc_no", "full_name", "email", "password", "directorate")}),
        ("Permissions", {"fields": ("is_staff", "is_active", "is_superuser", "groups", "user_permissions")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("tsc_no", "full_name", "email", "password1", "password2", "directorate", "is_staff", "is_active"),
        }),
    )

# --- 3. User Role Admin (Unified HOD & System Admin Logic) ---
class UserRoleForm(forms.ModelForm):
    # Field for System Admins
    system = forms.ChoiceField(
        choices=RequestedSystem.SYSTEM_CHOICES,
        required=False,
        label="System (Select if Role is System Admin)"
    )
    
    # Field for HODs
    directorate_assigned = forms.ModelChoiceField(
        queryset=Directorate.objects.all(),
        required=False,
        label="Directorate (Select if Role is HOD)"
    )

    class Meta:
        model = UserRole
        fields = ['user', 'role', 'system', 'directorate_assigned']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        if self.instance and self.instance.pk:
            user = self.instance.user
            
            # A. Load existing System for System Admins
            try:
                sys_admin = SystemAdmin.objects.get(user=user)
                self.fields['system'].initial = sys_admin.system
            except SystemAdmin.DoesNotExist:
                pass

            # B. Load Directorate for HODs (With Robust Error Handling)
            # We use .filter().first() instead of .get() to prevent crashing if duplicates already exist
            hod_assign = HodAssignment.objects.filter(hod_user=user).first()
            if hod_assign:
                self.fields['directorate_assigned'].initial = hod_assign.directorate
            elif user.directorate:
                # Fallback: Default to their profile directorate
                self.fields['directorate_assigned'].initial = user.directorate

    def save(self, commit=True):
        instance = super().save(commit=False)
        user = instance.user
        
        # --- Logic for System Administrators ---
        system_value = self.cleaned_data.get('system')
        if instance.role == 'sys_admin':
            if system_value:
                sys_admin, created = SystemAdmin.objects.get_or_create(user=user)
                sys_admin.system = system_value
                sys_admin.save()
        else:
            SystemAdmin.objects.filter(user=user).delete()

        # --- Logic for Head of Directorates (HOD) ---
        dir_value = self.cleaned_data.get('directorate_assigned')
        
        if instance.role == 'hod':
            if dir_value:
                # 1. CRITICAL FIX: Detach user from ANY OTHER directorates first.
                # This ensures the user is HOD of only ONE directorate at a time.
                HodAssignment.objects.filter(hod_user=user).exclude(directorate=dir_value).update(hod_user=None)

                # 2. Assign user to the NEW directorate
                HodAssignment.objects.update_or_create(
                    directorate=dir_value,
                    defaults={'hod_user': user}
                )
        else:
            # Cleanup: If role is no longer HOD, remove them from assignments
            HodAssignment.objects.filter(hod_user=user).update(hod_user=None)

        if commit:
            instance.save()
        return instance

@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    form = UserRoleForm
    list_display = ("user", "role", "get_assignment_display")
    list_filter = ("role",)
    search_fields = ("user__tsc_no", "user__full_name")

    def get_assignment_display(self, obj):
        """Displays the System or Directorate based on the role."""
        if obj.role == 'sys_admin':
            try:
                return f"System: {obj.user.systemadmin.get_system_display()}"
            except:
                return "System: Unassigned"
        elif obj.role == 'hod':
            # Use filter().first() to avoid crashing on duplicates
            assignment = HodAssignment.objects.filter(hod_user=obj.user).first()
            if assignment:
                return f"Directorate: {assignment.directorate.name}"
            return "Directorate: Unassigned"
        return "-"
    get_assignment_display.short_description = "Assignment Details"

@admin.register(SystemAdminAssignment)
class SystemAdminAssignmentAdmin(admin.ModelAdmin):
    list_display = ('get_system_display', 'admin_user', 'admin_email')
    list_filter = ('system',)
    search_fields = ('admin_user__full_name', 'admin_user__email', 'admin_email')

    def get_system_display(self, obj):
        return dict(SystemAdminAssignment.SYSTEM_CHOICES).get(obj.system, obj.system)
    get_system_display.short_description = "System"

# Safe Registration for CustomUser
try:
    admin.site.register(CustomUser, CustomUserAdmin)
except admin.sites.AlreadyRegistered:
    pass