from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.db.models import QuerySet
from django.db.models.functions import Collate
from django.http import HttpRequest

from .forms import CustomUserChangeForm, CustomUserCreationForm
from .models import CustomUser


class CustomUserAdmin(UserAdmin):
    model = CustomUser
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    list_display = (
        "email",
        "first_name",
        "last_name",
        "is_staff",
        "is_active",
    )
    list_filter = (
        "email",
        "first_name",
        "last_name",
        "is_staff",
        "is_active",
    )

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Permissions",
            {"fields": ("is_staff", "is_active", "groups", "user_permissions")},
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
    )
    search_fields = ("email_deterministic",)
    ordering = ("email",)

    def get_queryset(self, request: HttpRequest) -> QuerySet[CustomUser]:
        return (
            super()
            .get_queryset(request)
            .annotate(email_deterministic=Collate("email", "und-x-icu"))
        )


admin.site.register(CustomUser, CustomUserAdmin)
