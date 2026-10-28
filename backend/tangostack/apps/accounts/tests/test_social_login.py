from urllib.parse import parse_qs, urlparse

import pytest
from django.test import override_settings

pytestmark = pytest.mark.django_db

BASE = "/_allauth/browser/v1/auth"
CALLBACK = "/auth/callback"
GOOGLE = {"google": {"APPS": [{"client_id": "abc", "secret": "shh"}]}}


def provider_ids(client):
    flows = client.get(f"{BASE}/session").json()["data"]["flows"]
    return next(f["providers"] for f in flows if f["id"] == "provider_redirect")


def test_google_is_offered_only_when_its_credentials_are_set(client):
    with override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE):
        assert provider_ids(client) == ["google"]

    # whatever the environment has in .env, no credentials means no provider
    with override_settings(SOCIALACCOUNT_PROVIDERS={"google": {}}):
        flows = client.get(f"{BASE}/session").json()["data"]["flows"]
    assert "provider_redirect" not in {f["id"] for f in flows}


@override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE)
def test_redirect_flow_sends_the_browser_to_google(client):
    response = client.post(
        f"{BASE}/provider/redirect",
        {"provider": "google", "callback_url": CALLBACK, "process": "login"},
    )

    assert response.status_code == 302
    assert urlparse(response["location"]).netloc == "accounts.google.com"


@override_settings(SOCIALACCOUNT_PROVIDERS=GOOGLE)
def test_a_failed_login_returns_to_the_frontend_with_an_error(client):
    client.post(
        f"{BASE}/provider/redirect",
        {"provider": "google", "callback_url": CALLBACK, "process": "login"},
    )

    response = client.get("/accounts/google/login/callback/?error=access_denied")

    assert response.status_code == 302
    location = urlparse(response["location"])
    assert location.path == CALLBACK
    assert parse_qs(location.query)["error"]
