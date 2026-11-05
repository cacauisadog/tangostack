import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tangostack.settings")

app = Celery("tangostack")
# every `CELERY_*` setting in settings.py, and the `tasks.py` of each installed app
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
