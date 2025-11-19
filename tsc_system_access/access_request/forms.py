from django import forms
from .models import AccessRequest, Directorate, RequestedSystem
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import CustomUser
from django.contrib.auth.forms import UserCreationForm
from django import forms  # <-- The correct module for CharField and PasswordInput
from django.utils.translation import gettext as _ 
# Note: PasswordField doesn't exist; we use CharField + PasswordInput widget.
from django.core.exceptions import ValidationError



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





class CustomUserCreationForm(UserCreationForm):
    """
    FIXED VERSION:
    - Uses password1 & password2 (Django standard)
    - Fully compatible with UserAdmin
    - Uses TSC No as login field
    """

    password1 = forms.CharField(
        label="Password",
        strip=False,
        widget=forms.PasswordInput(attrs={'autocomplete': 'new-password'}),
    )
    password2 = forms.CharField(
        label="Confirm Password",
        strip=False,
        widget=forms.PasswordInput(attrs={'autocomplete': 'new-password'}),
    )

    class Meta:
        model = CustomUser
        fields = ('tsc_no', 'full_name', 'email', 'directorate')

    def clean_password2(self):
        pwd1 = self.cleaned_data.get("password1")
        pwd2 = self.cleaned_data.get("password2")

        if pwd1 and pwd2 and pwd1 != pwd2:
            raise ValidationError("Your passwords do not match.")
        return pwd2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])

        if commit:
            user.save()
        return user


class CustomUserChangeForm(UserChangeForm):
    """
    FIXED VERSION:
    - Used when editing a user
    - Password read-only field preserved
    """

    class Meta:
        model = CustomUser
        fields = (
            'tsc_no',
            'full_name',
            'email',
            'directorate',
            'is_active',
            'is_staff',
            'is_superuser',
        )