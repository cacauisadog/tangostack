"""The queue for real: published to a broker, taken off it like a worker does.

Every other test runs tasks inline, which never serializes anything: this one checks
that a real allauth email survives the trip (JSON payload, task found by its name)."""

import pytest
from django.core import mail

pytestmark = pytest.mark.django_db

SIGNUP = "/_allauth/browser/v1/auth/signup"


def test_signing_up_queues_the_confirmation_email(client, broker):
    response = client.post(
        SIGNUP,
        data={"email": "carla@example.com", "password": "a-good-password"},
        content_type="application/json",
    )

    assert response.status_code == 401  # "verify your email" is a pending flow
    assert mail.outbox == []  # queued, not sent
    assert broker.run_queued() == ["core.send_email"]
    (sent,) = mail.outbox
    assert sent.to == ["carla@example.com"]
    assert "/auth/verify-email/" in sent.body
