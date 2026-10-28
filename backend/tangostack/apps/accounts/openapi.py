from pathlib import Path

import allauth.headless.spec

# allauth ships an OpenAPI spec of its headless API (`openapi.yaml`, which
# includes `description.md`). We commit a copy in `openapi/allauth/` (the frontend
# generates its auth client from it) and a test fails when an allauth upgrade
# changes it.
ALLAUTH_SPEC_DIR = Path(allauth.headless.spec.__file__).parent / "doc"
SPEC_FILES = ("openapi.yaml", "description.md")
