import uuid
from datetime import UTC, datetime

import pytest

from tangostack.apps.core.models import Todo, TodoList

pytestmark = pytest.mark.django_db

UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"


def post(api_client, url, body):
    return api_client.post(url, data=body, content_type="application/json")


def patch(api_client, url, body):
    return api_client.patch(url, data=body, content_type="application/json")


def assert_validation_error(response, *loc):
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert [error["loc"] for error in errors] == [list(loc)]


class TestListLists:
    def test_returns_lists_with_their_todos_in_creation_order(self, api_client, user):
        work = TodoList.objects.create(owner=user, name="Work")
        home = TodoList.objects.create(owner=user, name="Home")
        Todo.objects.create(todo_list=work, text="one", done=True)
        Todo.objects.create(todo_list=work, text="two")
        Todo.objects.create(todo_list=home, text="three")

        response = api_client.get("/api/lists")

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

    def test_returns_an_empty_array_when_there_are_no_lists(self, api_client):
        response = api_client.get("/api/lists")

        assert response.status_code == 200
        assert response.json() == []

    def test_exposes_the_expected_fields(self, api_client, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")
        Todo.objects.create(todo_list=todo_list, text="one")

        [item] = api_client.get("/api/lists").json()

        assert set(item) == {"id", "name", "todos", "created_at", "updated_at"}
        assert set(item["todos"][0]) == {
            "id",
            "text",
            "done",
            "created_at",
            "updated_at",
        }

    def test_uses_a_constant_number_of_queries(
        self, api_client, django_assert_num_queries, user
    ):
        for i in range(5):
            todo_list = TodoList.objects.create(owner=user, name=f"list {i}")
            Todo.objects.create(todo_list=todo_list, text="a")
            Todo.objects.create(todo_list=todo_list, text="b")

        with django_assert_num_queries(4):  # session + user + lists + prefetched todos
            api_client.get("/api/lists")


class TestCreateList:
    def test_creates_a_list(self, api_client):
        response = post(api_client, "/api/lists", {"name": "Work"})

        assert response.status_code == 201
        body = response.json()
        assert body["name"] == "Work"
        assert body["todos"] == []
        assert TodoList.objects.get(id=body["id"]).name == "Work"

    def test_trims_surrounding_whitespace(self, api_client):
        response = post(api_client, "/api/lists", {"name": "  Work  "})

        assert response.status_code == 201
        assert response.json()["name"] == "Work"

    @pytest.mark.parametrize("name", ["", " ", "\t\n"])
    def test_rejects_a_blank_name(self, api_client, name):
        assert_validation_error(
            post(api_client, "/api/lists", {"name": name}), "body", "payload", "name"
        )
        assert not TodoList.objects.exists()

    def test_rejects_a_missing_name(self, api_client):
        assert_validation_error(
            post(api_client, "/api/lists", {}), "body", "payload", "name"
        )

    def test_rejects_a_name_longer_than_the_column(self, api_client):
        assert_validation_error(
            post(api_client, "/api/lists", {"name": "x" * 256}),
            "body",
            "payload",
            "name",
        )


class TestCreateTodo:
    def test_adds_a_todo_to_the_list(self, api_client, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")

        response = post(
            api_client, f"/api/lists/{todo_list.id}/todos", {"text": "Ship it"}
        )

        assert response.status_code == 201
        body = response.json()
        assert (body["text"], body["done"]) == ("Ship it", False)
        assert list(todo_list.todos.values_list("id", flat=True)) == [
            uuid.UUID(body["id"])
        ]

    def test_trims_surrounding_whitespace(self, api_client, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")

        response = post(
            api_client, f"/api/lists/{todo_list.id}/todos", {"text": " Ship it "}
        )

        assert response.json()["text"] == "Ship it"

    def test_returns_404_for_an_unknown_list(self, api_client):
        response = post(
            api_client, f"/api/lists/{UNKNOWN_ID}/todos", {"text": "Ship it"}
        )

        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}
        assert not Todo.objects.exists()

    @pytest.mark.parametrize("text", ["", "   "])
    def test_rejects_blank_text(self, api_client, text, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")

        assert_validation_error(
            post(api_client, f"/api/lists/{todo_list.id}/todos", {"text": text}),
            "body",
            "payload",
            "text",
        )
        assert not todo_list.todos.exists()

    def test_rejects_text_longer_than_the_column(self, api_client, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")

        assert_validation_error(
            post(api_client, f"/api/lists/{todo_list.id}/todos", {"text": "x" * 501}),
            "body",
            "payload",
            "text",
        )

    def test_rejects_a_malformed_list_id(self, api_client):
        assert_validation_error(
            post(api_client, "/api/lists/not-a-uuid/todos", {"text": "Ship it"}),
            "path",
            "list_id",
        )


class TestUpdateTodo:
    @pytest.mark.parametrize("done", [True, False])
    def test_sets_done(self, api_client, done, user):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(owner=user, name="Work"),
            text="Ship it",
            done=not done,
        )

        response = patch(api_client, f"/api/todos/{todo.id}", {"done": done})

        assert response.status_code == 200
        assert response.json()["done"] is done
        todo.refresh_from_db()
        assert todo.done is done

    def test_bumps_updated_at(self, api_client, user):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(owner=user, name="Work"), text="Ship it"
        )
        long_ago = datetime(2020, 1, 1, tzinfo=UTC)
        Todo.objects.filter(id=todo.id).update(updated_at=long_ago)

        patch(api_client, f"/api/todos/{todo.id}", {"done": True})

        todo.refresh_from_db()
        assert todo.updated_at > long_ago

    def test_an_empty_patch_changes_nothing(self, api_client, user):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(owner=user, name="Work"),
            text="Ship it",
            done=True,
        )

        response = patch(api_client, f"/api/todos/{todo.id}", {})

        assert response.status_code == 200
        assert response.json()["done"] is True

    def test_only_changes_the_given_todo(self, api_client, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")
        target = Todo.objects.create(todo_list=todo_list, text="same")
        other = Todo.objects.create(todo_list=todo_list, text="same")

        patch(api_client, f"/api/todos/{target.id}", {"done": True})

        other.refresh_from_db()
        assert other.done is False

    def test_returns_404_for_an_unknown_todo(self, api_client):
        response = patch(api_client, f"/api/todos/{UNKNOWN_ID}", {"done": True})

        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}

    def test_rejects_a_non_boolean_done(self, api_client, user):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(owner=user, name="Work"), text="Ship it"
        )

        assert_validation_error(
            patch(api_client, f"/api/todos/{todo.id}", {"done": "maybe"}),
            "body",
            "payload",
            "done",
        )

    @pytest.mark.parametrize("text", ["", "   ", "\t\n"])
    def test_rejects_blank_text(self, api_client, text, user):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(owner=user, name="Work"), text="Ship it"
        )

        assert_validation_error(
            patch(api_client, f"/api/todos/{todo.id}", {"text": text}),
            "body",
            "payload",
            "text",
        )

    def test_rejects_text_longer_than_the_column(self, api_client, user):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(owner=user, name="Work"), text="Ship it"
        )

        assert_validation_error(
            patch(api_client, f"/api/todos/{todo.id}", {"text": "x" * 501}),
            "body",
            "payload",
            "text",
        )

    @pytest.mark.parametrize("field", ["text", "done"])
    def test_rejects_an_explicit_null(self, api_client, field, user):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(owner=user, name="Work"), text="Ship it"
        )

        assert_validation_error(
            patch(api_client, f"/api/todos/{todo.id}", {field: None}),
            "body",
            "payload",
            field,
        )

    def test_edits_the_text_and_leaves_done_alone(self, api_client, user):
        todo = Todo.objects.create(
            todo_list=TodoList.objects.create(owner=user, name="Work"),
            text="Ship it",
            done=True,
        )

        response = patch(
            api_client, f"/api/todos/{todo.id}", {"text": "  Ship it today "}
        )

        assert response.status_code == 200
        assert response.json()["text"] == "Ship it today"
        todo.refresh_from_db()
        assert (todo.text, todo.done) == ("Ship it today", True)


class TestDeleteTodo:
    def test_deletes_only_the_given_todo(self, api_client, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")
        target = Todo.objects.create(todo_list=todo_list, text="same")
        other = Todo.objects.create(todo_list=todo_list, text="same")

        response = api_client.delete(f"/api/todos/{target.id}")

        assert response.status_code == 204
        assert response.content == b""
        assert list(Todo.objects.all()) == [other]

    def test_returns_404_for_an_unknown_todo(self, api_client):
        response = api_client.delete(f"/api/todos/{UNKNOWN_ID}")

        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}


class TestUpdateList:
    def test_renames_the_list(self, api_client, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")
        Todo.objects.create(todo_list=todo_list, text="Ship it")

        response = patch(
            api_client, f"/api/lists/{todo_list.id}", {"name": "  Office "}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Office"
        assert [todo["text"] for todo in body["todos"]] == ["Ship it"]
        todo_list.refresh_from_db()
        assert todo_list.name == "Office"

    def test_bumps_updated_at(self, api_client, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")
        long_ago = datetime(2020, 1, 1, tzinfo=UTC)
        TodoList.objects.filter(id=todo_list.id).update(updated_at=long_ago)

        patch(api_client, f"/api/lists/{todo_list.id}", {"name": "Office"})

        todo_list.refresh_from_db()
        assert todo_list.updated_at > long_ago

    @pytest.mark.parametrize("name", ["", "   ", "\t\n", None])
    def test_rejects_a_blank_or_null_name(self, api_client, name, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")

        assert_validation_error(
            patch(api_client, f"/api/lists/{todo_list.id}", {"name": name}),
            "body",
            "payload",
            "name",
        )

    def test_rejects_a_name_longer_than_the_column(self, api_client, user):
        todo_list = TodoList.objects.create(owner=user, name="Work")

        assert_validation_error(
            patch(api_client, f"/api/lists/{todo_list.id}", {"name": "x" * 256}),
            "body",
            "payload",
            "name",
        )

    def test_returns_404_for_an_unknown_list(self, api_client):
        response = patch(api_client, f"/api/lists/{UNKNOWN_ID}", {"name": "Office"})

        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}


class TestDeleteList:
    def test_deletes_the_list_with_its_todos_and_nothing_else(self, api_client, user):
        doomed = TodoList.objects.create(owner=user, name="Work")
        Todo.objects.create(todo_list=doomed, text="Ship it")
        kept = TodoList.objects.create(owner=user, name="Home")
        Todo.objects.create(todo_list=kept, text="Do laundry")

        response = api_client.delete(f"/api/lists/{doomed.id}")

        assert response.status_code == 204
        assert response.content == b""
        assert list(TodoList.objects.all()) == [kept]
        assert list(Todo.objects.values_list("text", flat=True)) == ["Do laundry"]

    def test_returns_404_for_an_unknown_list(self, api_client):
        response = api_client.delete(f"/api/lists/{UNKNOWN_ID}")

        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}
