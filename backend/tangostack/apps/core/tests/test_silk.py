import pytest
from django.conf import settings

pytestmark = pytest.mark.skipif(
    not settings.SILK_ENABLED, reason="silk is off (SILK_ENABLED=false)"
)


def test_silk_needs_no_login(client, db):
    assert client.get("/silk/").status_code == 200


def test_silk_records_requests(api_client, silk_on):
    from silk.models import Request

    api_client.get("/api/lists")

    assert Request.objects.filter(path="/api/lists").exists()
