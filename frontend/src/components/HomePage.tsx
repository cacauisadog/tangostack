import AppHeader from "#/components/auth/AppHeader";
import AuthGate from "#/components/auth/AuthGate";
import TodoApp from "#/components/todos/TodoApp";

export default function HomePage() {
  return (
    <AuthGate require="user">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <TodoApp />
      </main>
    </AuthGate>
  );
}
