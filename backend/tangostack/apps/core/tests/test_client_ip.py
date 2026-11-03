from allauth.core.internal.httpkit import get_client_ip
from django.test import RequestFactory, override_settings


@override_settings(ALLAUTH_TRUSTED_CLIENT_IP_HEADER="CF-Connecting-IP")
def test_allauth_reads_the_client_ip_from_the_trusted_header():
    request = RequestFactory().get("/", headers={"CF-Connecting-IP": "203.0.113.7"})

    assert get_client_ip(request) == "203.0.113.7"
