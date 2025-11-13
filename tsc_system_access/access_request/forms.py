from django import forms
from .models import AccessRequest, Directorate, RequestedSystem

SYSTEM_CHOICES = [
    ('1', 'Active Directory'),
    ('2', 'CRM'),
    ('3', 'EDMS'),
    ('4', 'Email'),
    ('5', 'Help Desk'),
    ('6', 'HRMIS'),
    ('7', 'IDEA'),
    ('8', 'IFMIS'),
    ('9', 'Knowledge Base'),
    ('10', 'Services'),
    ('11', 'Teachers Online'),
    ('12', 'TeamMate'),
    ('13', 'TPAD'),
    ('14', 'TPAY'),
    ('15', 'Pydio'),
]

REQUEST_CHOICES = [
    ('new', 'New User'),
    ('modify', 'Change/Modify User'),
    ('deactivate', 'Deactivate User'),
]


class AccessRequestForm(forms.ModelForm):
    systems = forms.MultipleChoiceField(
        choices=SYSTEM_CHOICES,
        widget=forms.SelectMultiple(attrs={
            'class': 'form-control select2',
            'style': 'width: 100%;'
        })
    )
    access_levels = forms.ChoiceField(
        choices=[('Admin', 'Admin'), ('User', 'User'), ('ICT', 'ICT')],
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    request_type = forms.ChoiceField(
        choices=REQUEST_CHOICES,
        widget=forms.RadioSelect
    )

    class Meta:
        model = AccessRequest
        exclude = [
            'status', 'hod_approver', 'ict_approver', 'submitted_at',
            'requester', 'hod_status', 'hod_comment', 'hod_decision_date',
            'directorate'   # ✅ excluded here
        ]
        widgets = {
            'tsc_no': forms.TextInput(attrs={'class': 'form-control'}),
            'designation': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
        }
