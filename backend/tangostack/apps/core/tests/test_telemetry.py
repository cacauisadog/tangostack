import logging
import os
import subprocess
import sys

from django.conf import settings

from tangostack import telemetry


def test_telemetry_is_off_by_default():
    assert settings.OTEL_ENABLED is False
    # a no-op: it imports nothing from OpenTelemetry (redis-py, loaded for Celery's
    # broker, imports the SDK on its own, so look at what `setup` adds)
    before = set(sys.modules)
    telemetry.setup()
    assert not [m for m in set(sys.modules) - before if m.startswith("opentelemetry")]
    assert telemetry._handler is None
    telemetry.attach_log_handler()  # also a no-op


def test_setup_starts_telemetry_only_when_enabled(settings, monkeypatch):
    started = []
    monkeypatch.setattr(telemetry, "_start", lambda: started.append(True))

    telemetry.setup()
    assert started == []

    settings.OTEL_ENABLED = True
    telemetry.setup()
    assert started == [True]


def test_shipped_log_records_lose_the_request_and_socket_objects():
    record = logging.makeLogRecord(
        {"msg": "hi", "request": object(), "socket": object(), "status_code": 200}
    )

    clean = telemetry._without_objects(record)

    assert not hasattr(clean, "request")
    assert not hasattr(clean, "socket")
    assert clean.status_code == 200
    assert hasattr(record, "request")  # the original is untouched


def test_the_log_handler_is_attached_once_and_reattached_when_django_resets_logging(
    monkeypatch,
):
    handler = logging.NullHandler()
    monkeypatch.setattr(telemetry, "_handler", handler)
    server = logging.getLogger("django.server")
    try:
        telemetry.attach_log_handler()
        telemetry.attach_log_handler()
        assert server.handlers.count(handler) == 1

        server.handlers.clear()  # what a second django.setup() does
        telemetry.attach_log_handler()
        assert handler in server.handlers
    finally:
        for name in telemetry._LOGGERS:
            logging.getLogger(name).removeHandler(handler)


def test_enabling_it_instruments_django_and_ships_logs():
    """In a fresh interpreter: the instrumentation is global and must not leak here."""
    code = """
import logging, django
django.setup()
from opentelemetry.instrumentation.django import DjangoInstrumentor
from tangostack import telemetry
assert DjangoInstrumentor().is_instrumented_by_opentelemetry
resource = telemetry._resource().attributes
assert resource["deployment.environment.name"] == "staging"
assert resource["service.name"] == "tangostack-worker"
assert telemetry._handler in logging.getLogger("django.server").handlers
assert telemetry._handler in logging.getLogger().handlers
# what a Celery worker does to the root logger on start-up
from celery.signals import after_setup_logger
logging.getLogger().handlers.clear()
after_setup_logger.send(sender=None, logger=logging.getLogger())
assert telemetry._handler in logging.getLogger().handlers
"""
    env = {
        **os.environ,
        "OTEL_ENABLED": "true",
        "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:1",
        "OTEL_ENVIRONMENT": "staging",
        "OTEL_SERVICE_NAME": "tangostack-worker",
    }
    env.pop("PYTEST_VERSION")
    env.pop("PYTEST_CURRENT_TEST")

    result = subprocess.run(
        [sys.executable, "-c", code],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode == 0, result.stderr
