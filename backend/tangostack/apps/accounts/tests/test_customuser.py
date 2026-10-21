import pytest
from django.db import IntegrityError
from django.test import override_settings
from django.urls import reverse

pytestmark = pytest.mark.django_db


class TestUserCreation:
    """
    Tests to guarantee that user creation works as expected,
    having `email` as the mandatory attribute.
    """

    def test_create_user(self, django_user_model):
        user = django_user_model.objects.create_user(
            email="normal@user.com", password="foo"
        )
        assert user.email == "normal@user.com"
        assert user.is_active is True
        assert user.is_staff is False
        assert user.is_superuser is False

        with pytest.raises(AttributeError):
            user.username
        with pytest.raises(TypeError):
            django_user_model.objects.create_user()
        with pytest.raises(TypeError):
            django_user_model.objects.create_user(email="")
        with pytest.raises(ValueError, match="The email must be set"):
            django_user_model.objects.create_user(email="", password="foo")

    def test_create_superuser(self, django_user_model):
        admin_user = django_user_model.objects.create_superuser(
            email="super@user.com", password="foo"
        )
        assert admin_user.email == "super@user.com"
        assert admin_user.is_active is True
        assert admin_user.is_staff is True
        assert admin_user.is_superuser is True

        with pytest.raises(AttributeError):
            admin_user.username
        with pytest.raises(TypeError):
            django_user_model.objects.create_superuser(email="")
        with pytest.raises(ValueError, match="The email must be set"):
            django_user_model.objects.create_superuser(email="", password="foo")
        with pytest.raises(ValueError):
            django_user_model.objects.create_superuser(
                email="super@user.com", password="foo", is_superuser=False
            )
        with pytest.raises(ValueError):
            django_user_model.objects.create_superuser(
                email="super@user.com", password="foo", is_staff=False
            )


class TestEmailCIProperties:
    """
    Tests to guarantee that filtering, searching and creating users by their email
    will always be case-insensitive
    """

    def test_email_case_insensitive_search(self, django_user_model):
        user = django_user_model.objects.create_user(
            email="test@example.com", password="password123"
        )
        assert django_user_model.objects.filter(
            email__iexact="TEST@EXAMPLE.COM"
        ).exists()
        user2 = django_user_model.objects.get(email="TeST@ExamPLE.coM")
        assert user == user2

    def test_email_case_insensitive_unique_creation(self, django_user_model):
        django_user_model.objects.create_user(
            email="Hacker@example.com", password="password123"
        )
        msg = 'duplicate key value violates unique constraint "accounts_customuser_email_key"'
        with pytest.raises(IntegrityError, match=msg):
            django_user_model.objects.create_user(
                email="hacker@example.com", password="password123"
            )


class TestCustomUserMethods:
    @pytest.fixture
    def custom_user(self, django_user_model):
        return django_user_model.objects.create_user(
            email="caue@email.com.br",
            password="password",
            first_name="Caue",
            last_name="Bittencourt",
        )

    def test_clean(self, custom_user):
        custom_user.email = "caue@EMAIL.COM.BR"
        custom_user.clean()
        assert custom_user.email == "caue@email.com.br"

    def test_get_full_name(self, custom_user):
        assert custom_user.get_full_name() == "Caue Bittencourt"

    def test_get_short_name(self, custom_user):
        assert custom_user.get_short_name() == "Caue"

    def test_email_user(self, custom_user):
        from django.core import mail

        custom_user.email_user("Email Subject", "Email message", "from@email.com")
        assert len(mail.outbox) == 1
        email = mail.outbox[0]
        assert email.subject == "Email Subject"
        assert email.body == "Email message"
        assert email.from_email == "from@email.com"


class TestCustomUserAdmin:
    """
    Tests to guarantee that filtering and searching users in the admin works as expected.

    Since in our CustomUser `email` is case-insensitive and nondeterministic, it ends up
    triggering the following error on Django's admin:
    `NotSupportedError: nondeterministic collations are not supported for LIKE`
    This happens because some Django lookups are mapped to SQL's `LIKE`, and PostgreSQL
    does not allow these types of queries on nondeterministic collations. One of these lookups
    is `icontains`, which is what Django admin uses by default on its `search_fields`.

    https://adamj.eu/tech/2023/02/23/migrate-django-postgresql-ci-fields-case-insensitive-collation/
    """

    @pytest.fixture
    def custom_superuser(self, django_user_model):
        return django_user_model.objects.create_superuser(
            email="caue@email.com.br",
            password="password",
            first_name="Caue",
            last_name="Bittencourt",
        )

    @override_settings(TREINOR_ENVIRONMENT="test")
    def test_get_queryset(self, client, django_user_model, custom_superuser):
        url = reverse("admin:accounts_customuser_changelist")

        # create users with emails on alphabetical order
        django_user_model.objects.create_user(email="ze@email.com", password="a")
        django_user_model.objects.create_user(email="ana@email.com", password="b")
        django_user_model.objects.create_user(email="bruno@email.com", password="c")

        client.force_login(custom_superuser)
        res = client.get(url)
        assert res.status_code == 200

        queryset = res.context["cl"].queryset

        # guaruantees that it found the correct number of users and in the correct order
        assert queryset.count() == 4
        assert queryset[0].email == "ana@email.com"
        assert queryset[1].email == "bruno@email.com"
        assert queryset[2].email == "caue@email.com.br"
        assert queryset[3].email == "ze@email.com"
