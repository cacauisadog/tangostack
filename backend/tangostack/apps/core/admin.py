from django.contrib import admin
from django.db.models import Count, QuerySet
from django.http import HttpRequest

from .models import Todo, TodoList


class TodoInline(admin.TabularInline):
    model = Todo
    extra = 0
    fields = ("text", "done")
    show_change_link = True


@admin.register(TodoList)
class TodoListAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "todo_count", "created_at", "updated_at")
    list_select_related = ("owner",)
    search_fields = ("name", "owner__email")
    autocomplete_fields = ("owner",)
    readonly_fields = ("created_at", "updated_at")
    inlines = (TodoInline,)

    def get_queryset(self, request: HttpRequest) -> QuerySet[TodoList]:
        return super().get_queryset(request).annotate(_todo_count=Count("todos"))

    @admin.display(description="Todos", ordering="_todo_count")
    def todo_count(self, obj: TodoList) -> int:
        return obj._todo_count  # type: ignore[attr-defined]


@admin.register(Todo)
class TodoAdmin(admin.ModelAdmin):
    list_display = ("text", "todo_list", "done", "created_at", "updated_at")
    list_filter = ("done",)
    list_select_related = ("todo_list",)
    search_fields = ("text", "todo_list__name", "todo_list__owner__email")
    autocomplete_fields = ("todo_list",)
    readonly_fields = ("created_at", "updated_at")
