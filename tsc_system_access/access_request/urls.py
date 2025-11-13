from django.urls import path
from . import views

urlpatterns = [
    path('', views.user_home, name='user_home'),
    path('role-redirect/', views.home_redirect, name='home_redirect'),
    path('submit/', views.submit_request, name='submit_request'),
    path('hod/', views.hod_dashboard, name='hod_dashboard'),
    path('ict/', views.ict_dashboard, name='ict_dashboard'),
    path('submitted/', views.request_submitted, name='request_submitted'),
    path('hod/dashboard/', views.hod_dashboard, name='hod_dashboard'),
    path("hod/decision/<int:system_id>/", views.hod_system_decision, name="hod_system_decision"),
    path('hod/approve/<int:request_id>/', views.approve_request, name='approve_request'),
    path('hod/reject/<int:request_id>/', views.reject_request, name='reject_request'),
    path('ict/dashboard/', views.ict_dashboard, name='ict_dashboard'),
    path("ict/decision/<int:system_id>/", views.ict_system_decision, name="ict_system_decision"),
    path('ict/approve/<int:pk>/', views.ict_approve, name='ict_approve'),
    path('ict/reject/<int:pk>/', views.ict_reject, name='ict_reject'),
    path("system-admin/dashboard/", views.system_admin_dashboard, name="system_admin_dashboard"),
    path("system-admin/decision/<int:pk>/", views.system_admin_decision, name="system_admin_decision"),
    path("overall-admin/dashboard/", views.overall_admin_dashboard, name="overall_admin_dashboard"),
    path("system-admin/export/<str:format>/", views.export_system_admin_data, name="export_system_admin_data"),






]
