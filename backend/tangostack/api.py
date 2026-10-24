from ninja import NinjaAPI

from tangostack.apps.core.api import router as core_router

api = NinjaAPI(
    title="Tangostack API",
    version="0.1.0",
    description="The backend owns this contract. Export it with `make api-export`.",
)

api.add_router("", core_router)
