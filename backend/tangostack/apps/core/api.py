from uuid import UUID

from django.shortcuts import get_object_or_404
from ninja import Router, Status

from .models import Todo, TodoList
from .schemas import (
    ErrorResponse,
    TodoCreate,
    TodoListCreate,
    TodoListResponse,
    TodoListUpdate,
    TodoResponse,
    TodoUpdate,
    ValidationErrorResponse,
)

router = Router()


def apply_patch(instance, payload):
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(instance, field, value)
    instance.save()  # not .update(): `updated_at` (auto_now) is only set by save()
    return instance


@router.get(
    "/lists",
    response={200: list[TodoListResponse], 401: ErrorResponse},
    operation_id="listLists",
    tags=["lists"],
    summary="List all to-do lists with their todos",
)
def list_lists(request):
    return TodoList.objects.filter(owner=request.user).prefetch_related("todos")


@router.post(
    "/lists",
    response={201: TodoListResponse, 401: ErrorResponse, 422: ValidationErrorResponse},
    operation_id="createList",
    tags=["lists"],
    summary="Create a to-do list",
)
def create_list(request, payload: TodoListCreate):
    return Status(201, TodoList.objects.create(owner=request.user, name=payload.name))


@router.post(
    "/lists/{list_id}/todos",
    response={
        201: TodoResponse,
        401: ErrorResponse,
        404: ErrorResponse,
        422: ValidationErrorResponse,
    },
    operation_id="createTodo",
    tags=["todos"],
    summary="Add a todo to a list",
)
def create_todo(request, list_id: UUID, payload: TodoCreate):
    todo_list = get_object_or_404(TodoList, id=list_id, owner=request.user)
    return Status(201, Todo.objects.create(todo_list=todo_list, text=payload.text))


@router.patch(
    "/lists/{list_id}",
    response={
        200: TodoListResponse,
        401: ErrorResponse,
        404: ErrorResponse,
        422: ValidationErrorResponse,
    },
    operation_id="updateList",
    tags=["lists"],
    summary="Update a to-do list (rename it)",
)
def update_list(request, list_id: UUID, payload: TodoListUpdate):
    todo_list = get_object_or_404(TodoList, id=list_id, owner=request.user)
    return apply_patch(todo_list, payload)


@router.delete(
    "/lists/{list_id}",
    response={204: None, 401: ErrorResponse, 404: ErrorResponse},
    operation_id="deleteList",
    tags=["lists"],
    summary="Delete a to-do list and its todos",
)
def delete_list(request, list_id: UUID):
    get_object_or_404(TodoList, id=list_id, owner=request.user).delete()
    return Status(204, None)


@router.patch(
    "/todos/{todo_id}",
    response={
        200: TodoResponse,
        401: ErrorResponse,
        404: ErrorResponse,
        422: ValidationErrorResponse,
    },
    operation_id="updateTodo",
    tags=["todos"],
    summary="Update a todo (edit its text, mark it done or undone)",
)
def update_todo(request, todo_id: UUID, payload: TodoUpdate):
    todo = get_object_or_404(Todo, id=todo_id, todo_list__owner=request.user)
    return apply_patch(todo, payload)


@router.delete(
    "/todos/{todo_id}",
    response={204: None, 401: ErrorResponse, 404: ErrorResponse},
    operation_id="deleteTodo",
    tags=["todos"],
    summary="Delete a todo",
)
def delete_todo(request, todo_id: UUID):
    get_object_or_404(Todo, id=todo_id, todo_list__owner=request.user).delete()
    return Status(204, None)
