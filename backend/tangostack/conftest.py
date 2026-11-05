from types import SimpleNamespace

import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client

from tangostack.celery import app as celery_app


@pytest.fixture(autouse=True)
def _clear_cache():
    """allauth rate-limits in the cache (e.g. one confirmation email per address
    every few minutes), which would leak between tests."""
    cache.clear()


@pytest.fixture(autouse=True)
def _tasks_run_inline(settings):
    """Background tasks run inside the test: no broker or worker, and a failing task
    raises. (The Celery app reads these from the Django settings.)"""
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True


@pytest.fixture(autouse=True)
def _emails_queue_at_once(monkeypatch):
    """Tests run inside a transaction that never commits, so `queue_email`'s
    after-commit hook would never fire: run it right away. (The tests of that hook
    itself override this fixture.)"""
    monkeypatch.setattr(
        "tangostack.apps.core.tasks.transaction",
        SimpleNamespace(on_commit=lambda function: function()),
    )


@pytest.fixture
def broker(settings, monkeypatch):
    """Real queueing instead of running tasks inline, on kombu's in-memory broker (no
    server needed). `broker.run_queued()` then does what a worker does: take each
    message off the queue and run its task. Tasks run in the test's thread, so they
    can use the database."""
    settings.CELERY_TASK_ALWAYS_EAGER = False
    # the environment variable beats the Django setting inside Celery
    monkeypatch.setenv("CELERY_BROKER_URL", "memory://")
    settings.CELERY_BROKER_TRANSPORT_OPTIONS = {}  # Redis-only options
    queue = celery_app.amqp.queues[celery_app.conf.task_default_queue]

    def reset():
        # the app keeps the connection it first published with: make it reconnect
        celery_app._after_fork()
        with celery_app.connection_for_write() as connection:
            connection.SimpleQueue(queue).clear()

    class Broker:
        @staticmethod
        def run_queued():
            """Runs and acknowledges everything queued; returns the task names."""
            names = []
            with (
                celery_app.connection_for_read() as connection,
                connection.SimpleQueue(queue) as simple_queue,
            ):
                while True:
                    try:
                        message = simple_queue.get(block=False)
                    except simple_queue.Empty:
                        return names
                    args, kwargs, _ = message.payload
                    name = message.headers["task"]
                    celery_app.tasks[name].apply(args=args, kwargs=kwargs, throw=True)
                    message.ack()
                    names.append(name)

    reset()
    yield Broker
    reset()


SILK = "silk.middleware.SilkyMiddleware"


@pytest.fixture(autouse=True)
def _silk_off(settings):
    """silk (dev only) writes to the database on every request, which would skew
    query counts. Tests that want it ask for `silk_on`."""
    settings.MIDDLEWARE = [m for m in settings.MIDDLEWARE if m != SILK]


@pytest.fixture
def silk_on(settings):
    settings.MIDDLEWARE = [*settings.MIDDLEWARE, SILK]


def create_verified_user(email):
    """A user who can log in: email verification is mandatory."""
    user = get_user_model().objects.create_user(email, "a-good-password")
    EmailAddress.objects.create(user=user, email=email, primary=True, verified=True)
    return user


@pytest.fixture
def user(db):
    return create_verified_user("alice@example.com")


@pytest.fixture
def other_user(db):
    return create_verified_user("bob@example.com")


@pytest.fixture
def api_client(user):
    """Signed in as `user`. For anonymous calls use pytest-django's `client`."""
    signed_in = Client()
    signed_in.force_login(user)
    return signed_in
