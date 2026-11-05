import smtplib
from unittest import mock

import pytest
from celery.exceptions import Retry
from django.core import mail
from django.core.mail import EmailMessage, EmailMultiAlternatives

from tangostack.apps.core.tasks import queue_email, send_email


@pytest.fixture(autouse=True)
def _emails_queue_at_once():
    """Overrides the conftest fixture: these tests are about the after-commit hook."""


def rendered_message():
    message = EmailMultiAlternatives(
        "Confirm",
        "plain body",
        "Tangostack <noreply@example.com>",
        ["carla@example.com"],
    )
    message.attach_alternative("<p>html body</p>", "text/html")
    return message


def test_the_task_sends_the_email_with_its_html_alternative():
    send_email.delay(
        subject="Confirm",
        body="plain body",
        from_email="Tangostack <noreply@example.com>",
        to=["carla@example.com"],
        html="<p>html body</p>",
    )

    (sent,) = mail.outbox
    assert (sent.subject, sent.body, sent.to) == (
        "Confirm",
        "plain body",
        ["carla@example.com"],
    )
    assert sent.from_email == "Tangostack <noreply@example.com>"
    assert sent.alternatives[0].content == "<p>html body</p>"
    assert sent.alternatives[0].mimetype == "text/html"


@pytest.mark.django_db
def test_queue_email_sends_after_the_commit_not_before(
    django_capture_on_commit_callbacks,
):
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        queue_email(rendered_message())

    assert mail.outbox == []  # still inside the transaction
    for callback in callbacks:
        callback()
    (sent,) = mail.outbox
    assert sent.body == "plain body"
    assert sent.alternatives[0].content == "<p>html body</p>"


@pytest.mark.django_db
def test_queue_email_keeps_an_html_only_message_html(
    django_capture_on_commit_callbacks,
):
    message = EmailMessage("Hi", "<b>hi</b>", "a@example.com", ["b@example.com"])
    message.content_subtype = "html"

    with django_capture_on_commit_callbacks(execute=True):
        queue_email(message)

    assert mail.outbox[0].content_subtype == "html"


@pytest.mark.django_db
def test_queue_email_refuses_attachments():
    message = rendered_message()
    message.attach("a.txt", "x", "text/plain")

    with pytest.raises(ValueError, match="attachments"):
        queue_email(message)


def test_a_failed_send_is_scheduled_for_another_try():
    # eagerly Celery doesn't run the retry, it raises `Retry` carrying the cause
    with (
        mock.patch.object(
            EmailMultiAlternatives, "send", side_effect=ConnectionRefusedError
        ),
        pytest.raises(Retry) as retry,
    ):
        send_email.delay("Hi", "body", "a@example.com", ["b@example.com"])

    assert isinstance(retry.value.exc, ConnectionRefusedError)
    assert 0 <= retry.value.when <= 30  # the first backoff: 30s, jittered
    assert mail.outbox == []


def test_it_gives_up_after_five_retries():
    with (
        mock.patch.object(
            EmailMultiAlternatives,
            "send",
            side_effect=smtplib.SMTPSenderRefused(
                550, b"domain not verified", "a@example.com"
            ),
        ),
        pytest.raises(smtplib.SMTPSenderRefused),
    ):
        send_email.apply(
            args=("Hi", "body", "a@example.com", ["b@example.com"]), retries=5
        )

    assert mail.outbox == []
