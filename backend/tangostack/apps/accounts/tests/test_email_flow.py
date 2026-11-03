import re
from urllib.parse import unquote

import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import Client

pytestmark = pytest.mark.django_db

BASE = "/_allauth/browser/v1/auth"
CREDENTIALS = {"email": "carla@example.com", "password": "a-good-password"}


def post(client, path, body):
    return client.post(f"{BASE}/{path}", data=body, content_type="application/json")


def link_key(message, page):
    """The key in the frontend link the email points to (`/auth/<page>/<key>`)."""
    match = re.search(rf"/auth/{page}/(\S+)", message.body)
    assert match, message.body
    return unquote(match.group(1))


def sign_up(client):
    return post(client, "signup", CREDENTIALS)


def test_signup_waits_for_the_emailed_link_before_logging_in(client):
    response = sign_up(client)

    assert response.status_code == 401
    flows = response.json()["data"]["flows"]
    assert {"id": "verify_email", "is_pending": True} in flows
    assert client.get("/api/lists").status_code == 401
    # logging in is refused too, until the address is verified
    assert post(client, "login", CREDENTIALS).status_code == 401

    (message,) = mail.outbox
    assert message.to == [CREDENTIALS["email"]]
    verified = post(client, "email/verify", {"key": link_key(message, "verify-email")})
    # 401 here means "verified, but still not signed in"
    assert verified.status_code == 401
    assert EmailAddress.objects.get().verified

    assert post(client, "login", CREDENTIALS).status_code == 200
    assert client.get("/api/lists").status_code == 200


def test_signing_up_again_does_not_reveal_that_the_address_exists(client, user):
    response = post(client, "signup", {**CREDENTIALS, "email": user.email})

    # same answer as a brand-new address; the owner is told by email instead
    assert response.status_code == 401
    assert {"id": "verify_email", "is_pending": True} in response.json()["data"][
        "flows"
    ]
    (message,) = mail.outbox
    assert message.to == [user.email]


def test_logging_in_with_an_unverified_address_sends_a_new_link(client):
    unverified = get_user_model().objects.create_user(
        CREDENTIALS["email"], CREDENTIALS["password"]
    )
    EmailAddress.objects.create(user=unverified, email=unverified.email, primary=True)

    response = post(client, "login", CREDENTIALS)

    assert response.status_code == 401
    (message,) = mail.outbox
    assert message.to == [CREDENTIALS["email"]]
    assert link_key(message, "verify-email")


def test_the_link_can_be_resent_by_logging_in_again_once_the_cooldown_is_over(client):
    # The "Resend email" button does exactly this (and waits out the cooldown).
    sign_up(client)
    assert len(mail.outbox) == 1

    assert post(client, "login", CREDENTIALS).status_code == 401
    # too soon: allauth sends one link per address every 3 minutes
    assert len(mail.outbox) == 1

    cache.clear()  # its rate limit lives in the cache: this is "3 minutes later"
    assert post(client, "login", CREDENTIALS).status_code == 401
    assert len(mail.outbox) == 2
    assert link_key(mail.outbox[1], "verify-email")


def test_a_superuser_created_on_the_command_line_can_log_in(client):
    get_user_model().objects.create_superuser("root@example.com", "a-good-password")

    response = post(
        client, "login", {"email": "root@example.com", "password": "a-good-password"}
    )

    assert response.status_code == 200


def test_emails_are_branded_multipart_with_a_text_and_an_html_part(client):
    sign_up(client)

    (message,) = mail.outbox
    (html, mimetype) = message.alternatives[0]
    assert mimetype == "text/html"
    assert message.subject == "Please Confirm Your Email Address"
    for body in (message.body, html):
        assert "Tangostack" in body
        assert "/auth/verify-email/" in body
    assert "<a href=" in html


def test_password_reset_links_to_the_frontend_and_sets_the_new_password(client, user):
    assert post(client, "password/request", {"email": user.email}).status_code == 200

    (message,) = mail.outbox
    assert message.to == [user.email]
    assert message.alternatives
    key = link_key(message, "reset-password")

    response = post(
        client, "password/reset", {"key": key, "password": "another-good-password"}
    )

    # 401: the password changed but nobody is logged in by the link alone
    assert response.status_code == 401
    old = post(Client(), "login", {"email": user.email, "password": "a-good-password"})
    assert old.status_code == 400
    new = post(
        Client(), "login", {"email": user.email, "password": "another-good-password"}
    )
    assert new.status_code == 200
