import pytest
from django.contrib.auth import get_user_model
from django.test import Client


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user("alice@example.com", "a-good-password")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user("bob@example.com", "a-good-password")


@pytest.fixture
def api_client(user):
    """Signed in as `user`. For anonymous calls use pytest-django's `client`."""
    signed_in = Client()
    signed_in.force_login(user)
    return signed_in
