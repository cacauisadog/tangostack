import json

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder

from tangostack.api import api


def test_committed_openapi_schema_is_up_to_date():
    """`api/openapi.json` feeds the frontend's Orval client; keep it in sync."""
    committed = json.loads(
        (settings.BASE_DIR.parent / "api" / "openapi.json").read_text()
    )
    current = json.loads(json.dumps(api.get_openapi_schema(), cls=DjangoJSONEncoder))

    assert committed == current, "api/openapi.json is stale. Run `make api-export`."
