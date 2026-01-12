from django.db import connections
from django.db.utils import OperationalError
from django.core.mail import get_connection
from django.conf import settings
import time

def check_database():
    try:
        db_conn = connections['default']
        start_time = time.time()
        db_conn.cursor()
        latency = (time.time() - start_time) * 1000  # ms
        return {'status': 'good', 'latency': f"{int(latency)}ms"}
    except OperationalError:
        return {'status': 'error', 'latency': '-'}

def check_email():
    try:
        connection = get_connection(
            backend=settings.EMAIL_BACKEND,
            fail_silently=False
        )
        # Verify connection (some backends don't support explicit open/close status check without sending, 
        # but opening a connection is a good test)
        connection.open()
        connection.close()
        return {'status': 'good', 'details': 'Connected'}
    except Exception:
        return {'status': 'error', 'details': 'Connection Failed'}

def get_server_stats():
    return {
        'version': 'v2.4.0', # Can be pulled from settings or a version file
        'environment': 'Production' if not settings.DEBUG else 'Development',
        'debug_mode': settings.DEBUG
    }
