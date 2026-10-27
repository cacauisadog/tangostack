import pytest
from django.test import Client

from tangostack.apps.core.models import Todo, TodoList

pytestmark = pytest.mark.django_db

SOME_ID = "00000000-0000-4000-8000-000000000000"


@pytest.fixture
def bobs_client(other_user):
    signed_in = Client()
    signed_in.force_login(other_user)
    return signed_in


@pytest.fixture
def alices_list(user):
    todo_list = TodoList.objects.create(owner=user, name="Alice's list")
    Todo.objects.create(todo_list=todo_list, text="Alice's todo")
    return todo_list


ENDPOINTS = [
    ("get", "/api/lists", None),
    ("post", "/api/lists", {"name": "x"}),
    ("post", f"/api/lists/{SOME_ID}/todos", {"text": "x"}),
    ("patch", f"/api/lists/{SOME_ID}", {"name": "x"}),
    ("delete", f"/api/lists/{SOME_ID}", None),
    ("patch", f"/api/todos/{SOME_ID}", {"done": True}),
    ("delete", f"/api/todos/{SOME_ID}", None),
]


@pytest.mark.parametrize(("method", "url", "body"), ENDPOINTS)
def test_every_endpoint_requires_a_login(client, method, url, body):
    kwargs = {"data": body, "content_type": "application/json"} if body else {}

    response = getattr(client, method)(url, **kwargs)

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}


def test_unsafe_requests_need_the_csrf_token(user):
    strict = Client(enforce_csrf_checks=True)
    strict.force_login(user)

    response = strict.post(
        "/api/lists", data={"name": "x"}, content_type="application/json"
    )

    assert response.status_code == 403
    assert not TodoList.objects.exists()


def test_a_list_is_created_for_the_signed_in_user(api_client, user):
    api_client.post(
        "/api/lists", data={"name": "Work"}, content_type="application/json"
    )

    assert TodoList.objects.get().owner == user


def test_users_only_see_their_own_lists(bobs_client, alices_list):
    TodoList.objects.create(owner=alices_list.owner, name="Another of Alice's")

    response = bobs_client.get("/api/lists")

    assert response.json() == []


def test_other_users_lists_and_todos_are_404(bobs_client, alices_list):
    todo = alices_list.todos.get()
    json = {"content_type": "application/json"}

    responses = [
        bobs_client.post(
            f"/api/lists/{alices_list.id}/todos", data={"text": "x"}, **json
        ),
        bobs_client.patch(f"/api/lists/{alices_list.id}", data={"name": "x"}, **json),
        bobs_client.delete(f"/api/lists/{alices_list.id}"),
        bobs_client.patch(f"/api/todos/{todo.id}", data={"done": True}, **json),
        bobs_client.delete(f"/api/todos/{todo.id}"),
    ]

    assert [r.status_code for r in responses] == [404] * 5
    alices_list.refresh_from_db()
    todo.refresh_from_db()
    assert alices_list.name == "Alice's list"
    assert (todo.text, todo.done) == ("Alice's todo", False)
    assert alices_list.todos.count() == 1


def test_deleting_a_user_deletes_their_lists(user, alices_list):
    user.delete()

    assert not TodoList.objects.exists()
    assert not Todo.objects.exists()
