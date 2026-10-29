import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client


@pytest.fixture(autouse=True)
def _clear_cache():
    """allauth rate-limits in the cache (e.g. one confirmation email per address
    every few minutes), which would leak between tests."""
    cache.clear()


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
