from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from . import api_views

router = DefaultRouter()
router.register(r'requests', api_views.AccessRequestViewSet)
router.register(r'systems', api_views.RequestedSystemViewSet)
router.register(r'directorates', api_views.DirectorateViewSet)
router.register(r'users', api_views.UserViewSet)
router.register(r'approvals', api_views.ApprovalViewSet, basename='approvals')
router.register(r'audit-logs', api_views.AuditLogViewSet)
router.register(r'security-policies', api_views.SecurityPolicyViewSet)
router.register(r'global-settings', api_views.GlobalSettingsViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('token/', api_views.CustomAuthToken.as_view(), name='api_token_auth'),
    path('logout/', api_views.LogoutView.as_view(), name='api_logout'),
]
