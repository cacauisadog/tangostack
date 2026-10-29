import pytest
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db

BASE = "/_allauth/browser/v1/auth"
CREDENTIALS = {"email": "carla@example.com", "password": "a-good-password"}


def post(client, path, body):
    return client.post(f"{BASE}/{path}", data=body, content_type="application/json")


def test_signup_creates_an_email_only_user(client):
    post(client, "signup", CREDENTIALS)

    user = get_user_model().objects.get()
    assert user.email == "carla@example.com"
    assert not hasattr(user, "username")


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


def test_signup_does_not_create_a_second_user_for_an_email_that_differs_by_case(
    client, user
):
    post(client, "signup", {**CREDENTIALS, "email": user.email.upper()})

    assert get_user_model().objects.get().pk == user.pk


def test_the_session_is_401_when_logged_out(client):
    response = client.get(f"{BASE}/session")

    assert response.status_code == 401
    assert response.json()["meta"]["is_authenticated"] is False
