import pytest
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db

BASE = "/_allauth/browser/v1/auth"
CREDENTIALS = {"email": "carla@example.com", "password": "a-good-password"}


def post(client, path, body):
    return client.post(f"{BASE}/{path}", data=body, content_type="application/json")


def test_signup_creates_an_email_only_user_and_signs_them_in(client):
    response = post(client, "signup", CREDENTIALS)

    assert response.status_code == 200
    assert response.json()["meta"]["is_authenticated"] is True
    assert get_user_model().objects.get().email == "carla@example.com"
    # no email verification: the session works straight away
    assert client.get("/api/lists").status_code == 200


def test_login_and_logout_with_email_and_password(client, user):
    assert (
        post(
            client, "login", {"email": user.email, "password": "a-good-password"}
        ).status_code
        == 200
    )
    assert client.get("/api/lists").status_code == 200

    # allauth answers a successful logout with 401
    assert client.delete(f"{BASE}/session").status_code == 401
    assert client.get("/api/lists").status_code == 401


def test_wrong_password_is_a_400_on_the_password_field(client, user):
    response = post(client, "login", {"email": user.email, "password": "nope"})

    assert response.status_code == 400
    assert response.json()["errors"][0]["param"] == "password"


def test_signup_applies_the_django_password_validators(client):
    response = post(client, "signup", {**CREDENTIALS, "password": "12345"})

    assert response.status_code == 400
    assert {e["param"] for e in response.json()["errors"]} == {"password"}
    assert not get_user_model().objects.exists()


def test_signup_rejects_an_email_that_differs_only_by_case(client, user):
    response = post(client, "signup", {**CREDENTIALS, "email": user.email.upper()})

    assert response.status_code == 400
    assert response.json()["errors"][0]["param"] == "email"


def test_the_session_is_401_when_logged_out(client):
    response = client.get(f"{BASE}/session")

    assert response.status_code == 401
    assert response.json()["meta"]["is_authenticated"] is False
