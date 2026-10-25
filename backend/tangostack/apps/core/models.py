import uuid
from typing import ClassVar

from django.db import models
from django.db.models import Q


class TodoList(models.Model):
    """A named to-do list."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering: ClassVar[list[str]] = ["created_at", "id"]
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=Q(name__regex=r"\S"),
                name="core_todolist_name_not_blank",
            ),
        ]

    def __str__(self):
        return self.name


class Todo(models.Model):
    """A single task in a list."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    todo_list = models.ForeignKey(
        TodoList, on_delete=models.CASCADE, related_name="todos"
    )
    text = models.CharField(max_length=500)
    done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering: ClassVar[list[str]] = ["created_at", "id"]
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=Q(text__regex=r"\S"),
                name="core_todo_text_not_blank",
            ),
        ]

    def __str__(self):
        return self.text
