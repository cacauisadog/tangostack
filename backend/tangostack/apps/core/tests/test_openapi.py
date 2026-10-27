import json

import pytest
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder

from tangostack.api import api
from tangostack.apps.accounts.openapi import ALLAUTH_SPEC_DIR, SPEC_FILES


def test_committed_openapi_schema_is_up_to_date():
    """`api/openapi.json` feeds the frontend's Orval client; keep it in sync."""
    committed = json.loads(
        (settings.BASE_DIR.parent / "api" / "openapi.json").read_text()
    )
    current = json.loads(json.dumps(api.get_openapi_schema(), cls=DjangoJSONEncoder))

    assert committed == current, "api/openapi.json is stale. Run `make api-export`."


@pytest.mark.parametrize("name", SPEC_FILES)
def test_committed_allauth_spec_is_up_to_date(name):
    """`api/allauth/` is a copy of the spec shipped with allauth."""
    committed = settings.BASE_DIR.parent / "api" / "allauth" / name

    assert committed.read_text() == (ALLAUTH_SPEC_DIR / name).read_text(), (
        f"api/allauth/{name} is stale. Run `make api-export`."
    )
