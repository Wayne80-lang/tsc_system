from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _
import re
from .models import SecurityPolicy

class DynamicStrongPasswordValidator:
    """
    Validate whether the password meets strong requirements IF the policy is enabled.
    Metric:
    - At least 12 characters
    - 1 uppercase, 1 lowercase
    - 1 digit
    - 1 symbol
    """
    def validate(self, password, user=None):
        try:
            policy = SecurityPolicy.objects.get(key='strong_password')
            if not policy.is_enabled:
                return
        except SecurityPolicy.DoesNotExist:
            return

        # Policy is active, enforce rules
        errors = []
        if len(password) < 12:
            errors.append("Password must be at least 12 characters long.")
        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter.")
        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter.")
        if not re.search(r'\d', password):
            errors.append("Password must contain at least one digit.")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain at least one symbol.")

        if errors:
            raise ValidationError(
                _("Strong Password Policy is active: " + " ".join(errors)),
                code='strong_password_policy',
            )

    def get_help_text(self):
        return _(
            "If strong password policy is active, your password must contain at least 12 characters, "
            "including uppercase, lowercase, digit, and symbol."
        )
