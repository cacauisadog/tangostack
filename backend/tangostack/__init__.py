# Loaded with Django, so `@shared_task` finds the app.
from .celery import app as celery_app

__all__ = ("celery_app",)
