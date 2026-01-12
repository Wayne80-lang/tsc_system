from django.utils import timezone
from django.contrib.auth.models import AnonymousUser

class UpdateLastActivityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # We check if user is authenticated and not anonymous
        if request.user.is_authenticated and not isinstance(request.user, AnonymousUser):
            # Update last_login to now
            # We use update_fields to minimize overhead, avoiding full row save
            # We only do this if enough time has passed? 
            # ideally yes, but for "Live" accuracy of 5 mins, we want it pretty fresh.
            # Let's say we update it if it's been more than 1 minute since last update?
            # Or just every request for simplicity for now. 
            
            # Optimization: check if we need to update to avoid DB write on every GET
            now = timezone.now()
            threshold = now - timezone.timedelta(minutes=1)
            
            if not request.user.last_login or request.user.last_login < threshold:
                 request.user.last_login = now
                 request.user.save(update_fields=['last_login'])

        return response
