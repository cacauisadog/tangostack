import { createFileRoute } from "@tanstack/react-router";
import TodoApp from "#/components/todos/TodoApp";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <TodoApp />
    </main>
  );
}
