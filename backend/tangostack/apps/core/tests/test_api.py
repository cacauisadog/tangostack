import uuid
from datetime import UTC, datetime

import pytest

from tangostack.apps.core.models import Todo, TodoList

pytestmark = pytest.mark.django_db

UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"


def post(client, url, body):
    return client.post(url, data=body, content_type="application/json")


def patch(client, url, body):
    return client.patch(url, data=body, content_type="application/json")


def assert_validation_error(response, *loc):
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert [error["loc"] for error in errors] == [list(loc)]


class TestListLists:
    def test_returns_lists_with_their_todos_in_creation_order(self, client):
        work = TodoList.objects.create(name="Work")
        home = TodoList.objects.create(name="Home")
        Todo.objects.create(todo_list=work, text="one", done=True)
        Todo.objects.create(todo_list=work, text="two")
        Todo.objects.create(todo_list=home, text="three")

        response = client.get("/api/lists")

        assert response.status_code == 200
        body = response.json()
        assert [
            (item["name"], [t["text"] for t in item["todos"]]) for item in body
        ] == [
            ("Work", ["one", "two"]),
            ("Home", ["three"]),
        ]
        assert body[0]["todos"][0]["done"] is True
        assert body[0]["todos"][1]["done"] is False

    def test_returns_an_empty_array_when_there_are_no_lists(self, client):
        response = client.get("/api/lists")

        assert response.status_code == 200
        assert response.json() == []

    def test_exposes_the_expected_fields(self, client):
        todo_list = TodoList.objects.create(name="Work")
        Todo.objects.create(todo_list=todo_list, text="one")

        [item] = client.get("/api/lists").json()

        assert set(item) == {"id", "name", "todos", "created_at", "updated_at"}
        assert set(item["todos"][0]) == {
            "id",
            "text",
            "done",
            "created_at",
            "updated_at",
        }

    def test_uses_a_constant_number_of_queries(self, client, django_assert_num_queries):
        for i in range(5):
            todo_list = TodoList.objects.create(name=f"list {i}")
            Todo.objects.create(todo_list=todo_list, text="a")
            Todo.objects.create(todo_list=todo_list, text="b")

        with django_assert_num_queries(2):  # lists + prefetched todos
            client.get("/api/lists")


class TestCreateList:
    def test_creates_a_list(self, client):
        response = post(client, "/api/lists", {"name": "Work"})

        assert response.status_code == 201
        body = response.json()
        assert body["name"] == "Work"
        assert body["todos"] == []
        assert TodoList.objects.get(id=body["id"]).name == "Work"

    def test_trims_surrounding_whitespace(self, client):
        response = post(client, "/api/lists", {"name": "  Work  "})

        assert response.status_code == 201
        assert response.json()["name"] == "Work"

    @pytest.mark.parametrize("name", ["", " ", "\t\n"])
    def test_rejects_a_blank_name(self, client, name):
        assert_validation_error(
            post(client, "/api/lists", {"name": name}), "body", "payload", "name"
        )
        assert not TodoList.objects.exists()

    def test_rejects_a_missing_name(self, client):
        assert_validation_error(
            post(client, "/api/lists", {}), "body", "payload", "name"
        )

    def test_rejects_a_name_longer_than_the_column(self, client):
        assert_validation_error(
            post(client, "/api/lists", {"name": "x" * 256}), "body", "payload", "name"
        )


class TestCreateTodo:
    def test_adds_a_todo_to_the_list(self, client):
        todo_list = TodoList.objects.create(name="Work")

        response = post(client, f"/api/lists/{todo_list.id}/todos", {"text": "Ship it"})

        assert response.status_code == 201
        body = response.json()
        assert (body["text"], body["done"]) == ("Ship it", False)
        assert list(todo_list.todos.values_list("id", flat=True)) == [
            uuid.UUID(body["id"])
        ]

    def test_trims_surrounding_whitespace(self, client):
        todo_list = TodoList.objects.create(name="Work")

        response = post(
            client, f"/api/lists/{todo_list.id}/todos", {"text": " Ship it "}
        )

        assert response.json()["text"] == "Ship it"

    def test_returns_404_for_an_unknown_list(self, client):
        response = post(client, f"/api/lists/{UNKNOWN_ID}/todos", {"text": "Ship it"})

        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}
        assert not Todo.objects.exists()

    @pytest.mark.parametrize("text", ["", "   "])
    def test_rejects_blank_text(self, client, text):
        todo_list = TodoList.objects.create(name="Work")

        assert_validation_error(
            post(client, f"/api/lists/{todo_list.id}/todos", {"text": text}),
            "body",
            "payload",
            "text",
        )
        assert not todo_list.todos.exists()

    def test_rejects_text_longer_than_the_column(self, client):
        todo_list = TodoList.objects.create(name="Work")

        assert_validation_error(
            post(client, f"/api/lists/{todo_list.id}/todos", {"text": "x" * 501}),
            "body",
            "payload",
            "text",
        )

    def test_rejects_a_malformed_list_id(self, client):
        assert_validation_error(
            post(client, "/api/lists/not-a-uuid/todos", {"text": "Ship it"}),
            "path",
            "list_id",
        )


class TestUpdateTodo:
    @pytest.mark.parametrize("done", [True, False])
    def test_sets_done(self, client, done):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(name="Work"),
            text="Ship it",
            done=not done,
        )

        response = patch(client, f"/api/todos/{todo.id}", {"done": done})

        assert response.status_code == 200
        assert response.json()["done"] is done
        todo.refresh_from_db()
        assert todo.done is done

    def test_bumps_updated_at(self, client):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(name="Work"), text="Ship it"
        )
        long_ago = datetime(2020, 1, 1, tzinfo=UTC)
        Todo.objects.filter(id=todo.id).update(updated_at=long_ago)

        patch(client, f"/api/todos/{todo.id}", {"done": True})

        todo.refresh_from_db()
        assert todo.updated_at > long_ago

    def test_an_empty_patch_changes_nothing(self, client):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(name="Work"), text="Ship it", done=True
        )

        response = patch(client, f"/api/todos/{todo.id}", {})

        assert response.status_code == 200
        assert response.json()["done"] is True

    def test_only_changes_the_given_todo(self, client):
        todo_list = TodoList.objects.create(name="Work")
        target = Todo.objects.create(todo_list=todo_list, text="same")
        other = Todo.objects.create(todo_list=todo_list, text="same")

        patch(client, f"/api/todos/{target.id}", {"done": True})

        other.refresh_from_db()
        assert other.done is False

    def test_returns_404_for_an_unknown_todo(self, client):
        response = patch(client, f"/api/todos/{UNKNOWN_ID}", {"done": True})

        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}

    def test_rejects_a_non_boolean_done(self, client):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(name="Work"), text="Ship it"
        )

        assert_validation_error(
            patch(client, f"/api/todos/{todo.id}", {"done": "maybe"}),
            "body",
            "payload",
            "done",
        )
