from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from ninja import Schema
from pydantic import Field, StringConstraints

# Lengths mirror the column sizes in `models.py`. Whitespace is stripped before
# validation, so blank (whitespace-only) values fail `min_length`.
ListName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]
TodoText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
]


class TodoResponse(Schema):
    id: UUID
    text: str
    done: bool
    created_at: datetime
    updated_at: datetime


class TodoListResponse(Schema):
    id: UUID
    name: str
    todos: list[TodoResponse]
    created_at: datetime
    updated_at: datetime


class TodoListCreate(Schema):
    name: ListName


class TodoCreate(Schema):
    text: TodoText


# Partial updates: omitted fields are left alone. The `None` defaults are not
# `Optional`s, so an explicit `null` is rejected (422) instead of reaching the
# NOT NULL columns, and the spec shows plain optional (non-nullable) fields.
class TodoListUpdate(Schema):
    name: ListName = Field(default=None)


class TodoUpdate(Schema):
    text: TodoText = Field(default=None)
    done: bool = Field(default=None)


class ErrorResponse(Schema):
    detail: str


class ValidationErrorItem(Schema):
    """One entry of Ninja's standard 422 body (a Pydantic validation error)."""

    type: str
    loc: list[str | int]
    msg: str
    ctx: dict[str, Any] | None = None


class ValidationErrorResponse(Schema):
    detail: list[ValidationErrorItem]
