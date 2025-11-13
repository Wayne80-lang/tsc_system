from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from django import forms
from .models import CustomUser, SystemAdminAssignment, UserRole, Directorate, SystemAdmin, RequestedSystem


@admin.register(Directorate)
class DirectorateAdmin(admin.ModelAdmin):
    list_display = ['name', 'hod_email']
    search_fields = ['name', 'hod_email']


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

class UserRoleForm(forms.ModelForm):
    system = forms.ChoiceField(
        choices = RequestedSystem.SYSTEM_CHOICES,
        required = False,
        label = "System (for System Admins)"
    )
    class Meta:
        model = UserRole
        fields = ['user', 'role', 'system']
    
    def _init_(self, *args, **kwargs):
        super()._init_(*args, **kwargs)
        
        if self.instance and self.instance.user_id:
            try:
                sys_admin = SystemAdmin.objects.get(user=self.instance.user)
                self.fields['system'].initial = sys_admin.system
            except SystemAdmin.DoesNotExist:
                pass

    
    def save(self, commit=True):
        instance = super().save(commit=False)
        system_value = self.cleaned_data.get('system')

        if instance.role == 'system_admin':
            # Create or update the SystemAdmin entry
            sys_admin, created = SystemAdmin.objects.get_or_create(user=instance.user)
            sys_admin.system = system_value or sys_admin.system
            sys_admin.save()
        else:
            # Delete any existing SystemAdmin if role changed
            SystemAdmin.objects.filter(user=instance.user).delete()

        if commit:
            instance.save()
        return instance



class UserRoleAdmin(admin.ModelAdmin):
    form = UserRoleForm
    list_display = ("user", "role")
    list_filter = ("role",)
    search_fields = ("user__tsc_no", "user__full_name")

    # ✅ filter HOD dropdown
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "hod":
            kwargs["queryset"] = CustomUser.objects.filter(userrole__role="hod")
        return super().formfield_for_foreignkey(db_field, request, **kwargs)



@admin.register(SystemAdminAssignment)
class SystemAdminAssignmentAdmin(admin.ModelAdmin):
    list_display = ('get_system_display', 'admin_user', 'admin_email')
    list_filter = ('system',)
    search_fields = ('admin_user__full_name', 'admin_user__email', 'admin_email')

    def get_system_display(self, obj):
        return dict(SystemAdminAssignment.SYSTEM_CHOICES).get(obj.system, obj.system)
    get_system_display.short_description = "System"





# ✅ Avoid duplicate registration
try:
    admin.site.register(CustomUser, CustomUserAdmin)
except admin.sites.AlreadyRegistered:
    pass

try:
    admin.site.register(UserRole, UserRoleAdmin)
except admin.sites.AlreadyRegistered:
    pass
