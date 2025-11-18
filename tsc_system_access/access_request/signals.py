from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import CustomUser, UserRole, SystemAdmin, Directorate
from .models import UserProfile, AccessLog
from django.contrib.auth.signals import user_logged_in

@receiver(post_save, sender=CustomUser)
def create_user_role(sender, instance, created, **kwargs):
    """
    Automatically create a UserRole for every new CustomUser.
    Ensures no duplicate UserRole objects are created.
    """
    if created:
        UserRole.objects.get_or_create(user=instance, defaults={'role': 'staff'})


@receiver(post_save, sender=UserRole)
def create_or_update_system_admin(sender, instance, created, **kwargs):
    if instance.role == 'sys_admin':
        system_admin, created_admin = SystemAdmin.objects.get_or_create(user=instance.user)
        if created_admin and not system_admin.system:
            system_admin.system = '1'
        system_admin.save()
    else:
        # remove SystemAdmin record if role is changed away from sys_admin
        SystemAdmin.objects.filter(user=instance.user).delete()


@receiver(post_save, sender=UserRole)
def sync_hod_to_directorate(sender, instance, created, **kwargs):
    """If a user is set to role 'hod', automatically assign them as HOD for their own directorate.
    This mirrors prior behavior where ICT (or any) department HOD is inferred from role + department.
    """
    if instance.role == 'hod':
        user = instance.user
        if user and getattr(user, 'directorate', None) and user.directorate_id:
            try:
                dir_obj = Directorate.objects.get(pk=user.directorate_id)
                # set official HOD email to the user's email
                if user.email and dir_obj.hod_email != user.email:
                    dir_obj.hod_email = user.email
                    dir_obj.save(update_fields=['hod_email'])
            except Directorate.DoesNotExist:
                pass

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    # Get IP Address
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    
    AccessLog.objects.create(user=user, action="Login", ip_address=ip)