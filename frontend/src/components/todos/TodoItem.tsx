import { Checkbox } from "#/components/ui/checkbox";
import { cn } from "#/lib/utils";
import type { Todo } from "./types";

interface TodoItemProps {
  todo: Todo;
  onToggle: () => void;
}

export default function TodoItem({ todo, onToggle }: TodoItemProps) {
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
    </li>
  );
}
