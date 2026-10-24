import pytest
from django.db import IntegrityError, transaction

from tangostack.apps.core.models import Todo, TodoList

pytestmark = pytest.mark.django_db

BLANK_VALUES = ["", " ", "   ", "\t", "\n", " \t\n "]


@pytest.mark.parametrize("name", BLANK_VALUES)
def test_blank_list_name_is_rejected_by_the_database(name):
    with pytest.raises(IntegrityError), transaction.atomic():
        TodoList.objects.create(name=name)


@pytest.mark.parametrize("text", BLANK_VALUES)
def test_blank_todo_text_is_rejected_by_the_database(text):
    todo_list = TodoList.objects.create(name="Work")

    with pytest.raises(IntegrityError), transaction.atomic():
        Todo.objects.create(todo_list=todo_list, text=text)
