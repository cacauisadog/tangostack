import logging
import smtplib
from unittest import mock

import pytest
from django.core import mail
from kombu.exceptions import OperationalError

pytestmark = pytest.mark.django_db

SIGNUP = "/_allauth/browser/v1/auth/signup"
CREDENTIALS = {"email": "carla@example.com", "password": "a-good-password"}


def broker_down():
    """`delay` as it fails when the broker can't be reached."""
    return mock.patch(
        "tangostack.apps.core.tasks.send_email.delay",
        side_effect=OperationalError("broker down"),
    )


def sign_up(client):
    return client.post(SIGNUP, data=CREDENTIALS, content_type="application/json")


def test_with_the_broker_down_the_email_is_sent_from_the_request(client, caplog):
    with broker_down(), caplog.at_level(logging.ERROR):
        response = sign_up(client)

    assert response.status_code == 401
    (message,) = mail.outbox
    assert message.to == ["carla@example.com"]
    assert "Queueing an email failed" in caplog.text


def test_with_the_broker_and_the_provider_down_signup_still_answers(client, caplog):
    with (
        broker_down(),
        mock.patch(
            "tangostack.apps.core.tasks.send_email.run",
            side_effect=smtplib.SMTPServerDisconnected,
        ),
        caplog.at_level(logging.ERROR),
    ):
        response = sign_up(client)

    assert response.status_code == 401
    assert "Sending an email directly failed" in caplog.text
