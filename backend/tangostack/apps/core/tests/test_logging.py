import logging


def test_django_errors_reach_the_console_whatever_debug_is():
    # Django's default handler is filtered on DEBUG, so with DEBUG off a 500's
    # traceback went nowhere: ours has no such filter.
    handlers = logging.getLogger("django").handlers

    assert any(
        isinstance(handler, logging.StreamHandler) and not handler.filters
        for handler in handlers
    )


def test_our_own_loggers_reach_the_console_too():
    # With OpenTelemetry on, a handler sits on the root logger and Python no longer
    # prints what has no handler of its own: our tasks' errors went nowhere visible.
    handlers = logging.getLogger("tangostack.apps.core.tasks").handlers
    parent = logging.getLogger("tangostack").handlers

    assert any(
        isinstance(handler, logging.StreamHandler) for handler in [*handlers, *parent]
    )
