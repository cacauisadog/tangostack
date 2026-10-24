from uuid import UUID

from django.shortcuts import get_object_or_404
from ninja import Router, Status

from .models import Todo, TodoList
from .schemas import (
    ErrorResponse,
    TodoCreate,
    TodoListCreate,
    TodoListResponse,
    TodoResponse,
    TodoUpdate,
    ValidationErrorResponse,
)

router = Router()


@router.get(
    "/lists",
    response=list[TodoListResponse],
    operation_id="listLists",
    tags=["lists"],
    summary="List all to-do lists with their todos",
)
def list_lists(request):
    return TodoList.objects.prefetch_related("todos")


@router.post(
    "/lists",
    response={201: TodoListResponse, 422: ValidationErrorResponse},
    operation_id="createList",
    tags=["lists"],
    summary="Create a to-do list",
)
def create_list(request, payload: TodoListCreate):
    return Status(201, TodoList.objects.create(name=payload.name))


@router.post(
    "/lists/{list_id}/todos",
    response={201: TodoResponse, 404: ErrorResponse, 422: ValidationErrorResponse},
    operation_id="createTodo",
    tags=["todos"],
    summary="Add a todo to a list",
)
def create_todo(request, list_id: UUID, payload: TodoCreate):
    todo_list = get_object_or_404(TodoList, id=list_id)
    return Status(201, Todo.objects.create(todo_list=todo_list, text=payload.text))


@router.patch(
    "/todos/{todo_id}",
    response={200: TodoResponse, 404: ErrorResponse, 422: ValidationErrorResponse},
    operation_id="updateTodo",
    tags=["todos"],
    summary="Update a todo (mark done or undone)",
)
def update_todo(request, todo_id: UUID, payload: TodoUpdate):
    todo = get_object_or_404(Todo, id=todo_id)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(todo, field, value)
    todo.save()  # not .update(): `updated_at` (auto_now) is only set by save()
    return todo
