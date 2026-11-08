"""OpenTelemetry: request metrics, logs and traces, sent over OTLP/HTTP to a collector.

Off unless OTEL_ENABLED is set (see settings.py); nothing from OpenTelemetry is
imported otherwise. `make obs` starts the local collector, Prometheus, Loki, Tempo and
Grafana. Called from CoreConfig.ready(), so every entry point (runserver, gunicorn,
management commands) is covered, and once per process.
"""

import copy
import logging
import os

from django.conf import settings

# The root logger plus the ones that don't propagate to it but are worth shipping.
_LOGGERS = ("", "django.server", "gunicorn.access", "gunicorn.error")

_handler = None


def _without_objects(record):
    """A copy of the record without the request (or socket) Django attaches to it:
    their reprs would only add noise to every shipped line. A copy, because other
    handlers (e.g. mail_admins) read `record.request`."""
    clean = copy.copy(record)
    for key in ("request", "socket"):
        clean.__dict__.pop(key, None)
    return clean


def attach_log_handler():
    """Idempotent. `runserver` imports wsgi.py, which runs django.setup() a second time
    and with it Django's logging config, wiping the handler from `django.server`:
    wsgi.py calls this again afterwards."""
    if _handler is None:
        return
    for name in _LOGGERS:
        logger = logging.getLogger(name)
        if _handler not in logger.handlers:
            logger.addHandler(_handler)


def _resource():
    from opentelemetry.sdk.resources import Resource

    return Resource.create(
        {
            "service.name": settings.OTEL_SERVICE_NAME,
            "deployment.environment.name": settings.OTEL_ENVIRONMENT,
        }
    )


def setup():
    if settings.OTEL_ENABLED:
        _start()


def _start():  # pragma: no cover (exercised in a subprocess: test_telemetry.py)
    global _handler

    # The stable HTTP conventions: `http.server.request.duration` in seconds,
    # labelled with the route template (not the raw URL).
    os.environ.setdefault("OTEL_SEMCONV_STABILITY_OPT_IN", "http")

    from celery.signals import after_setup_logger
    from opentelemetry import metrics, trace
    from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
    from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
        OTLPMetricExporter,
    )
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.celery import CeleryInstrumentor
    from opentelemetry.instrumentation.django import DjangoInstrumentor
    from opentelemetry.instrumentation.logging.handler import LoggingHandler
    from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor
    from opentelemetry.sdk._logs import LoggerProvider
    from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT.rstrip("/")
    resource = _resource()

    reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=f"{endpoint}/v1/metrics"),
        export_interval_millis=10_000,
    )
    metrics.set_meter_provider(
        MeterProvider(resource=resource, metric_readers=[reader])
    )

    # Every span goes to the collector, which keeps the interesting traces (tail
    # sampling, see observability/otel-collector.yaml).
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces"))
    )
    trace.set_tracer_provider(tracer_provider)

    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(
        BatchLogRecordProcessor(OTLPLogExporter(endpoint=f"{endpoint}/v1/logs"))
    )

    class Handler(LoggingHandler):
        def emit(self, record):
            super().emit(_without_objects(record))

    _handler = Handler(level=logging.INFO, logger_provider=logger_provider)
    attach_log_handler()
    # A Celery worker empties the root logger's handlers while it starts (and installs
    # its own console one): put ours back.
    after_setup_logger.connect(lambda **_: attach_log_handler(), weak=False)
    # The root logger defaults to WARNING, which would drop the INFO lines.
    logging.getLogger().setLevel(logging.INFO)

    # Static files and silk's own pages would only add noise to the endpoint stats.
    DjangoInstrumentor().instrument(
        excluded_urls="static/.*,silk/.*,api/health", tracer_provider=tracer_provider
    )
    # Spans for each query and each Celery task (linked to the request that queued it).
    PsycopgInstrumentor().instrument(tracer_provider=tracer_provider)
    CeleryInstrumentor().instrument(tracer_provider=tracer_provider)
    # It puts its middleware first, and that one reads the request's host (which
    # ALLOWED_HOSTS rejects for the container probe): the health check goes back to
    # the front, before anything looks at the host.
    health = "tangostack.apps.core.middleware.HealthCheckMiddleware"
    settings.MIDDLEWARE.remove(health)
    settings.MIDDLEWARE.insert(0, health)
