import smtplib
import socket
import ssl

from celery import shared_task
from django.core.mail import EmailMessage, EmailMultiAlternatives
from django.db import transaction

# what Django's SMTP backend raises when the provider refuses or can't be reached
EMAIL_ERRORS = (
    smtplib.SMTPException,
    ConnectionError,
    TimeoutError,
    socket.gaierror,
    ssl.SSLError,
)


@shared_task(
    # a fixed name: renaming this module must not orphan tasks already in the queue
    name="core.send_email",
    autoretry_for=EMAIL_ERRORS,
    # 30s, 1m, 2m, 4m, 8m (jittered): long enough to ride out a provider hiccup, or
    # for a fixed config (say, a newly verified sender domain) to be deployed
    retry_backoff=30,
    retry_backoff_max=900,
    retry_jitter=True,
    max_retries=5,
)
def send_email(
    subject, body, from_email, to, html=None, content_subtype="plain", reply_to=None
):
    """Sends one email. Runs in the worker, so only plain data goes in.

    It can run twice (an unacknowledged task is redelivered), which for the emails
    we send, a confirmation link or a reset link, is harmless.
    """
    message = EmailMultiAlternatives(subject, body, from_email, to, reply_to=reply_to)
    message.content_subtype = content_subtype
    if html:
        message.attach_alternative(html, "text/html")
    message.send()


def queue_email(message: EmailMessage) -> None:
    """Hands a rendered email to the worker, once the current transaction commits.

    Waiting for the commit means a request that rolls back (a failed signup) sends
    nothing, and the worker never runs ahead of data the email is about.
    Attachments aren't supported: nothing we send has one.
    """
    if message.attachments:
        raise ValueError("queue_email doesn't support attachments")
    html = next(
        (
            content
            for content, mimetype in getattr(message, "alternatives", [])
            if mimetype == "text/html"
        ),
        None,
    )
    payload = {
        "subject": message.subject,
        "body": message.body,
        "from_email": message.from_email,
        "to": list(message.to),
        "html": html,
        "content_subtype": message.content_subtype,
        "reply_to": list(message.reply_to) or None,
    }
    transaction.on_commit(lambda: send_email.delay(**payload))
