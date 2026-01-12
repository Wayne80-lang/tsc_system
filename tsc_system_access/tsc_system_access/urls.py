from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('access/', include('access_request.urls')),  # your app URLs
    path('api/', include('access_request.api_urls')), # Expose API at root /api/ using dedicated api_urls

    # login/logout
    path('accounts/login/', auth_views.LoginView.as_view(template_name='access_request/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),

    # default root → login
    path('', auth_views.LoginView.as_view(template_name='access_request/login.html'), name='root_login'),
]
