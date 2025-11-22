import csv
import io
import json
from datetime import timedelta, datetime
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Count
from django.contrib.admin import SimpleListFilter
from django.utils.timezone import localdate
from django.contrib.admin.models import LogEntry

# PDF & Excel Imports
from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet

from .forms import CustomUserChangeForm, CustomUserCreationForm

from .models import (
    CustomUser, UserRole, Directorate, 
    RequestedSystem, AccessRequest, SystemAnalytics, AccessLog
)

# ==========================================
# 0. CONFIGURATION
# ==========================================
admin.site.site_header = "TSC SYSTEM ADMINISTRATION"
admin.site.site_title = "TSC Admin Portal"
admin.site.index_title = "System Control Center"

# ==========================================
# 1. FILTERS & HELPERS
# ==========================================
class OverdueFilter(SimpleListFilter):
    title = 'Turnaround Status'
    parameter_name = 'turnaround'
    def lookups(self, request, model_admin):
        return (('overdue', '⚠️ Overdue (>3 Days)'), ('today', '📅 Submitted Today'))
    def queryset(self, request, queryset):
        now = timezone.now()
        if self.value() == 'overdue':
            threshold = now - timedelta(days=3)
            return queryset.filter(submitted_at__lt=threshold).exclude(status__in=['approved', 'rejected_hod', 'rejected_ict'])
        if self.value() == 'today':
            return queryset.filter(submitted_at__date=now.date())

def export_to_csv(modeladmin, request, queryset):
    opts = modeladmin.model._meta
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename=TSC_{opts.verbose_name_plural}_{timezone.now().date()}.csv'
    writer = csv.writer(response)
    fields = [field.name for field in opts.get_fields() if not field.many_to_many and not field.one_to_many]
    writer.writerow(fields)
    for obj in queryset:
        data_row = []
        for field in fields:
            value = getattr(obj, field)
            if callable(value): value = value()
            if isinstance(value, datetime): value = value.strftime('%Y-%m-%d %H:%M')
            data_row.append(value)
        writer.writerow(data_row)
    return response
export_to_csv.short_description = "📊 Export Selected to CSV"

def revoke_access(modeladmin, request, queryset):
    queryset.update(sysadmin_status='revoked', sysadmin_decision_date=timezone.now())
    modeladmin.message_user(request, "Selected rights have been REVOKED.")
revoke_access.short_description = "⛔ Revoke Access (Security)"

# ==========================================
# 2. INLINES
# ==========================================
class UserRoleInline(admin.StackedInline):
    model = UserRole
    can_delete = False
    fk_name = 'user'
    classes = ('collapse',)

class SystemAdminInline(admin.StackedInline):
    model = UserRole
    fk_name = 'user'
    extra = 0
    classes = ('collapse',)
    fields = ('role',)
    verbose_name_plural = "Role Assignment"

class RequestedSystemInline(admin.TabularInline):
    model = RequestedSystem
    extra = 0
    can_delete = False
    fields = ('system', 'level_of_access', 'visual_status', 'sysadmin_comment')
    readonly_fields = ('system', 'level_of_access', 'visual_status', 'sysadmin_comment')
    def visual_status(self, obj):
        colors = {'approved': 'green', 'rejected': 'red', 'pending': 'orange', 'revoked': 'black'}
        return format_html('<span style="color:{}; font-weight:900;">● {}</span>', colors.get(obj.sysadmin_status, 'gray'), obj.get_sysadmin_status_display())
    visual_status.short_description = "Status"

# ==========================================
# 3. ADMIN CLASSES
# ==========================================

@admin.register(Directorate)
class DirectorateAdmin(admin.ModelAdmin):
    list_display = ['name', 'hod_email', 'staff_count']
    search_fields = ['name', 'hod_email']
    def staff_count(self, obj): return obj.users.count()


class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = CustomUser

    list_display = ('tsc_no', 'full_name', 'email', 'directorate', 'is_staff')
    search_fields = ('tsc_no', 'full_name', 'email')
    ordering = ('tsc_no',)

    fieldsets = (
        (None, {'fields': ('tsc_no', 'password')}),
        ('Personal info', {'fields': ('full_name', 'email', 'directorate')}),
        ('Permissions', {
            'fields': (
                'is_active',
                'is_staff',
                'is_superuser',
                'groups',
                'user_permissions'
            )
        }),
        ('Important dates', {'fields': ('last_login', )}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'tsc_no',
                'full_name',
                'email',
                'directorate',
                'password1',
                'password2',
            ),
        }),
    )


admin.site.register(CustomUser, CustomUserAdmin)

@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "get_assignment")
    search_fields = ("user__tsc_no", "user__full_name")
    list_filter = ('role',)
    
    fieldsets = (
        ('User & Role', {
            'fields': ('user', 'role'),
        }),
        ('HOD Assignment (for HOD role)', {
            'fields': ('directorate',),
            'classes': ('collapse',),
        }),
        ('System Admin Assignment (for System Admin role)', {
            'fields': ('system_assigned',),
            'classes': ('collapse',),
        }),
        ('Staff Manager (for Staff role)', {
            'fields': ('hod',),
            'classes': ('collapse',),
        }),
    )
    
    class Media:
        js = ('admin/js/userrole_admin.js',)
    
    def get_assignment(self, obj):
        if obj.role == 'sys_admin' and obj.system_assigned: 
            return f"System: {obj.get_system_assigned_display()}"
        if obj.role == 'hod' and obj.directorate: 
            return f"Directorate: {obj.directorate.name}"
        if obj.role == 'staff' and obj.hod: 
            return f"Manager: {obj.hod.full_name}"
        return "-"
    get_assignment.short_description = "Assignment"

@admin.register(AccessRequest)
class AccessRequestAdmin(admin.ModelAdmin):
    class Media: css = {'all': ('css/tsc_admin.css',)}
    list_display = ('requester_info', 'progress_visual', 'status_badge', 'submitted_at', 'turnaround_time')
    list_filter = (OverdueFilter, 'status', 'directorate', 'submitted_at')
    search_fields = ('requester__full_name', 'requester__tsc_no', 'tsc_no')
    inlines = [RequestedSystemInline]
    date_hierarchy = 'submitted_at'
    actions = [export_to_csv]
    list_per_page = 20

    def requester_info(self, obj): return format_html("<strong>{}</strong><br><span style='color:#666;'>{}</span>", obj.requester.full_name, obj.tsc_no)
    def turnaround_time(self, obj):
        delta = timezone.now() - obj.submitted_at
        color = "red" if delta.days > 3 else "green"
        return format_html('<span style="color: {}; font-weight:bold;">{} days</span>', color, delta.days)
    def progress_visual(self, obj):
        percent = 10
        color = "#ffc107"
        if obj.status == 'pending_hod': percent = 25
        elif obj.status == 'pending_ict': percent = 60; color = "#17a2b8"
        elif obj.status == 'approved': percent = 100; color = "#28a745"
        elif 'rejected' in obj.status: percent = 100; color = "#dc3545"
        return format_html('<div class="progress-container"><div class="progress-bar" style="width: {}%; background-color: {};">{}%</div></div>', percent, color, percent)
    def status_badge(self, obj):
        colors = {'approved': '#28a745', 'rejected_hod': '#dc3545', 'rejected_ict': '#dc3545', 'pending_hod': '#ffc107', 'pending_ict': '#17a2b8'}
        bg_color = colors.get(obj.status, '#6c757d')
        return format_html('<span style="background-color:{}; color:white; padding:5px 10px; border-radius:12px; font-size:10px; font-weight:bold;">{}</span>', bg_color, obj.get_status_display().upper())

# ✅ 1. AUDIT LOG ADMIN (System Rights)
@admin.register(RequestedSystem)
class AuditLogAdmin(admin.ModelAdmin):
    class Media: css = {'all': ('css/tsc_admin.css',)}
    list_display = ('request_ref', 'system_badge', 'sysadmin_status_colored', 'action_dates')
    list_filter = ('sysadmin_status', 'system', 'directorate', 'access_request__submitted_at')
    search_fields = ('access_request__requester__full_name', 'access_request__tsc_no')
    date_hierarchy = 'access_request__submitted_at'
    actions = [export_to_csv, revoke_access] 

    def request_ref(self, obj): return f"{obj.access_request.requester.full_name}"
    def system_badge(self, obj): return format_html('<span style="color:#001F54; font-weight:bold;">{}</span>', obj.get_system_display())
    def sysadmin_status_colored(self, obj):
        colors = {'approved': 'green', 'rejected': 'red', 'revoked': 'black', 'pending': 'orange'}
        return format_html('<span style="color:{}; font-weight:bold;">{}</span>', colors.get(obj.sysadmin_status, 'black'), obj.sysadmin_status.upper())
    def action_dates(self, obj): return obj.sysadmin_decision_date.strftime('%Y-%m-%d') if obj.sysadmin_decision_date else "-"


# ✅ 2. ACCESS LOG ADMIN (Login History)
@admin.register(AccessLog)
class AccessLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'timestamp', 'ip_address')
    list_filter = ('action', 'timestamp')
    search_fields = ('user__full_name', 'user__tsc_no', 'ip_address')
    date_hierarchy = 'timestamp'
    
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False


# ✅ 3. DASHBOARD (SYSTEM ANALYTICS)
@admin.register(SystemAnalytics)
class SystemAnalyticsAdmin(admin.ModelAdmin):
    change_list_template = 'admin/system_analytics.html'
    date_hierarchy = 'submitted_at'
    
    def changelist_view(self, request, extra_context=None):
        # 1. GATHER DATA
        total = AccessRequest.objects.count()
        
        threshold = timezone.now() - timedelta(days=3)
        overdue = AccessRequest.objects.filter(
            submitted_at__lt=threshold, status__in=['pending_hod', 'pending_ict']
        ).count()
        
        # Active Staff (Unique users with approved rights)
        active_staff_count = RequestedSystem.objects.filter(sysadmin_status='approved')\
            .values('access_request__requester').distinct().count()
        
        raw_rights = RequestedSystem.objects.filter(sysadmin_status='approved')\
            .values('system').annotate(count=Count('id')).order_by('-count')
        
        system_map = dict(RequestedSystem.SYSTEM_CHOICES)
        granted_rights = [{'name': system_map.get(r['system'], r['system']), 'count': r['count']} for r in raw_rights]

        # Recent Logs for the "Tab" view
        recent_logs = AccessLog.objects.select_related('user').order_by('-timestamp')[:20]

        # 2. EXPORT EXCEL
        if 'export_excel' in request.GET:
            wb = Workbook()
            ws = wb.active
            ws.title = "Executive Dashboard"
            ws.append(["TSC SYSTEM ACCESS REPORT"])
            ws.append(["Generated On:", datetime.now().strftime('%Y-%m-%d %H:%M')])
            ws.append([])
            ws.append(["Active Staff (Unique Users)", active_staff_count])
            ws.append(["Total Requests", total])
            ws.append(["Overdue", overdue])
            ws.append([])
            ws.append(["SYSTEM NAME", "USERS"])
            for item in granted_rights: ws.append([item['name'], item['count']])
            response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            response["Content-Disposition"] = f'attachment; filename="TSC_Dashboard_{localdate()}.xlsx"'
            wb.save(response)
            return response

        # 3. EXPORT PDF
        if 'export_pdf' in request.GET:
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            elements = []
            styles = getSampleStyleSheet()
            elements.append(Paragraph("TSC EXECUTIVE DASHBOARD", styles['Title']))
            elements.append(Paragraph(f"Active Staff With Rights: {active_staff_count}", styles['Heading2']))
            elements.append(Spacer(1, 20))
            data = [["System Name", "Users"]]
            for item in granted_rights: data.append([item['name'], str(item['count'])])
            t = Table(data, colWidths=[250, 100])
            t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), colors.navy), ('TEXTCOLOR', (0,0), (-1,0), colors.gold), ('GRID', (0,0), (-1,-1), 1, colors.black)]))
            elements.append(t)
            doc.build(elements)
            buffer.seek(0)
            return HttpResponse(buffer, content_type='application/pdf')

        # 4. RENDER
        extra_context = extra_context or {}
        extra_context['title'] = "Executive System Dashboard"
        extra_context['total_requests'] = total
        extra_context['overdue_requests'] = overdue
        extra_context['active_staff_count'] = active_staff_count
        extra_context['granted_rights'] = granted_rights
        extra_context['recent_logs'] = recent_logs
        
        extra_context['chart_labels'] = [x['name'] for x in granted_rights]
        extra_context['chart_data'] = [x['count'] for x in granted_rights]
        
        return super().changelist_view(request, extra_context=extra_context)


# REMOVED: SystemAdminAssignment & HodAssignment registrations (consolidated into UserRole)
# Use UserRole admin to manage HOD and System Admin assignments

@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ('action_time', 'user', 'content_type', 'action_flag', 'change_message')
    list_filter = ('action_time', 'user', 'action_flag')
    search_fields = ('object_repr', 'change_message')
    date_hierarchy = 'action_time'
    
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False