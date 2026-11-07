from django.utils.csp import CSP
from django.views.decorators.csp import csp_override, csp_report_only_override
from ninja import NinjaAPI
from ninja.security import django_auth

from tangostack.apps.core.api import router as core_router

# The docs page (Swagger UI) loads its script and styles from jsDelivr and has inline
# scripts: it gets its own, looser policy instead of loosening everyone's.
_DOCS_CSP = {
    "default-src": [CSP.SELF],
    "script-src": [CSP.SELF, CSP.UNSAFE_INLINE, "https://cdn.jsdelivr.net"],
    "style-src": [CSP.SELF, CSP.UNSAFE_INLINE, "https://cdn.jsdelivr.net"],
    "img-src": [CSP.SELF, "data:", "https://django-ninja.dev"],
    "object-src": [CSP.NONE],
    "frame-ancestors": [CSP.NONE],
}


def _docs_decorator(view):
    return csp_override(_DOCS_CSP)(csp_report_only_override({})(view))


api = NinjaAPI(
    title="Tangostack API",
    version="0.1.0",
    auth=django_auth,  # session cookie from allauth; enforces CSRF on unsafe methods
    description="The backend owns this contract. Export it with `make api-export`.",
    docs_decorator=_docs_decorator,
)

api.add_router("", core_router)
