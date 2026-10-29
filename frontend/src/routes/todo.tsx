import { createFileRoute } from "@tanstack/react-router";
import TodoPage from "#/components/todos/TodoPage";

// The signed-in app is client-rendered: its data comes from the browser (cookie
// session, mock worker), so the server sends only the document shell.
export const Route = createFileRoute("/todo")({ ssr: false, component: TodoPage });
