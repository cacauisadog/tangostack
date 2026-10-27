from ninja import NinjaAPI
from ninja.security import django_auth

from tangostack.apps.core.api import router as core_router

api = NinjaAPI(
    title="Tangostack API",
    version="0.1.0",
    auth=django_auth,  # session cookie from allauth; enforces CSRF on unsafe methods
    description="The backend owns this contract. Export it with `make api-export`.",
)

api.add_router("", core_router)
