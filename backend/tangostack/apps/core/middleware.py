import logging

from django.db import DatabaseError, connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)

HEALTH_PATH = "/api/health"


class HealthCheckMiddleware:
    """Answers `GET /api/health` for the platform's health checks: 200 when the
    database answers, 503 when it doesn't.

    It sits first in `MIDDLEWARE` on purpose: a container probe asks for
    `localhost` or the container's IP, which `ALLOWED_HOSTS` rejects, and the
    host is only checked once a later middleware looks at it.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == HEALTH_PATH and request.method in ("GET", "HEAD"):
            return self.check()
        return self.get_response(request)

    def check(self):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except DatabaseError:
            logger.warning("Health check: the database is unreachable", exc_info=True)
            body, status = {"status": "unavailable"}, 503
        else:
            body, status = {"status": "ok"}, 200
        response = JsonResponse(body, status=status)
        response["Cache-Control"] = "no-store"
        return response
