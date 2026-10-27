import pytest
from django.urls import reverse

from tangostack.apps.core.models import Todo, TodoList

pytestmark = pytest.mark.django_db


def test_list_changelist_shows_todo_counts(admin_client, user):
    work = TodoList.objects.create(owner=user, name="Work")
    Todo.objects.create(todo_list=work, text="send report")
    Todo.objects.create(todo_list=work, text="book flights")
    TodoList.objects.create(owner=user, name="Home")

    response = admin_client.get(reverse("admin:core_todolist_changelist"))

    assert response.status_code == 200
    rows = {row.name: row._todo_count for row in response.context["cl"].result_list}
    assert rows == {"Work": 2, "Home": 0}
