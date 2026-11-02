import logging


def test_django_errors_reach_the_console_whatever_debug_is():
    # Django's default handler is filtered on DEBUG, so with DEBUG off a 500's
    # traceback went nowhere: ours has no such filter.
    handlers = logging.getLogger("django").handlers

    assert any(
        isinstance(handler, logging.StreamHandler) and not handler.filters
        for handler in handlers
    )
