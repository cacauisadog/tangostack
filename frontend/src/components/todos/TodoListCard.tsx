import { PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import InlineEdit from "./InlineEdit";
import InlineForm from "./InlineForm";
import TodoItem from "./TodoItem";
import type { TodoList } from "./types";

interface TodoListCardProps {
  list: TodoList;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddTodo: (text: string) => void;
  onToggleTodo: (todoId: string) => void;
  onEditTodo: (todoId: string, text: string) => void;
  onDeleteTodo: (todoId: string) => void;
}

export default function TodoListCard({
  list,
  onRename,
  onDelete,
  onAddTodo,
  onToggleTodo,
  onEditTodo,
  onDeleteTodo,
}: TodoListCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const doneCount = list.todos.filter((t) => t.done).length;

  return (
    <Card>
      <CardHeader>
        {renaming ? (
          <InlineEdit
            value={list.name}
            label={`Rename list "${list.name}"`}
            onSave={(name) => {
              onRename(name);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <CardTitle>{list.name}</CardTitle>
            <CardAction className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Rename list "${list.name}"`}
                onClick={() => setRenaming(true)}
              >
                <PencilIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete list "${list.name}"`}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2Icon />
              </Button>
            </CardAction>
          </>
        )}
        <CardDescription>
          {doneCount}/{list.todos.length} done
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {list.todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={() => onToggleTodo(todo.id)}
              onEdit={(text) => onEditTodo(todo.id, text)}
              onDelete={() => onDeleteTodo(todo.id)}
            />
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <InlineForm
          triggerLabel="Add task"
          placeholder="Task name"
          submitLabel="Add"
          onSubmit={onAddTodo}
        />
      </CardFooter>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{list.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {list.todos.length === 0
                ? "This list is empty."
                : `This also deletes its ${list.todos.length} ${list.todos.length === 1 ? "task" : "tasks"}.`}{" "}
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
