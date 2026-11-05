from allauth.account.adapter import DefaultAccountAdapter
from allauth.core import context as allauth_context
from django.contrib.sites.shortcuts import get_current_site

from tangostack.apps.core.tasks import queue_email


class AccountAdapter(DefaultAccountAdapter):
    """Every email allauth sends (confirmation, reset, "account already exists"...)
    goes through `send_mail`: render it here, let the worker deliver it, so the
    request doesn't wait for (or fail with) the mail provider."""

    def send_mail(self, template_prefix, email, context):
        request = allauth_context.request
        rendered_context = {
            "request": request,
            "email": email,
            "current_site": get_current_site(request),
            **context,
        }
        queue_email(self.render_mail(template_prefix, email, rendered_context))
