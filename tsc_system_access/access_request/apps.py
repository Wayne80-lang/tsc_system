from django.apps import AppConfig
from django.db.models.signals import post_save



class AccessRequestConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'access_request'

    def ready(self):
        import access_request.signals