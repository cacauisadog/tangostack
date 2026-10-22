import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import InlineForm from "./InlineForm";
import TodoItem from "./TodoItem";
import type { TodoList } from "./types";

interface TodoListCardProps {
  list: TodoList;
  onAddTodo: (text: string) => void;
  onToggleTodo: (todoId: string) => void;
}

export default function TodoListCard({ list, onAddTodo, onToggleTodo }: TodoListCardProps) {
  const doneCount = list.todos.filter((t) => t.done).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{list.name}</CardTitle>
        <CardDescription>
          {doneCount}/{list.todos.length} done
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {list.todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} onToggle={() => onToggleTodo(todo.id)} />
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
    </Card>
  );
}
