import { PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { cn } from "#/lib/utils";
import InlineEdit from "./InlineEdit";
import type { Todo } from "./types";

interface TodoItemProps {
  todo: Todo;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
}

export default function TodoItem({ todo, onToggle, onEdit, onDelete }: TodoItemProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="flex items-center gap-3 rounded-md px-2 py-1.5">
        <InlineEdit
          value={todo.text}
          label={`Edit task "${todo.text}"`}
          onSave={(text) => {
            onEdit(text);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
      <Checkbox id={todo.id} checked={todo.done} onCheckedChange={onToggle} />
      <label
        htmlFor={todo.id}
        className={cn(
          "flex-1 cursor-pointer text-sm",
          todo.done && "text-muted-foreground line-through",
        )}
      >
        {todo.text}
      </label>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Edit task "${todo.text}"`}
        onClick={() => setEditing(true)}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Delete task "${todo.text}"`}
        onClick={onDelete}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
