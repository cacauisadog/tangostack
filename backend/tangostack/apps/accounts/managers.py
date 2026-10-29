from django.contrib.auth.base_user import BaseUserManager
from django.utils.translation import gettext_lazy as _


class CustomUserManager(BaseUserManager):
    """
    `CustomUserManager` for the `CustomUser`.

    Two main differences from the standard manager:
    1. has no `username` field;
    2. since it has no `username`, the unique identifier is the `email`.

    Superusers also get a verified `EmailAddress` (see `create_superuser`).

    This manager guarantees that a `CustomUser` must always be created
    *without* an username and *with* an email.
    """

    def create_user(self, email, password, **extra_fields):
        """
        Create and save a user with the given email and password.
        """
        if not email:
            raise ValueError(_("The email must be set"))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password, **extra_fields):
        """
        Create and save a SuperUser with the given email and password.
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))
        user = self.create_user(email, password, **extra_fields)
        # Logging in through the app requires a verified address; whoever runs
        # `createsuperuser` has no inbox to confirm from, so vouch for it here.
        from allauth.account.models import EmailAddress

        EmailAddress.objects.create(
            user=user, email=user.email, primary=True, verified=True
        )
        return user
