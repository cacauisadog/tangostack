import { delay, http, HttpResponse } from "msw";
import type {
  Error as ApiErrorBody,
  NewTodo,
  NewTodoList,
  Todo,
  TodoList,
  TodoUpdate,
} from "#/api/generated/model";
import { db } from "./db";

const notFound = (what: string) =>
  HttpResponse.json<ApiErrorBody>({ message: `${what} not found` }, { status: 404 });
const invalid = (message: string) => HttpResponse.json<ApiErrorBody>({ message }, { status: 422 });

/** One handler per operation in api/openapi.yaml. */
export const handlers = [
  http.get("*/api/lists", async () => {
    await delay();
    return HttpResponse.json<TodoList[]>(db.getLists());
  }),

  http.post<never, NewTodoList>("*/api/lists", async ({ request }) => {
    await delay();
    const { name } = await request.json();
    if (!name?.trim()) return invalid("name is required");
    return HttpResponse.json<TodoList>(db.addList(name.trim()), { status: 201 });
  }),

  http.post<{ listId: string }, NewTodo>(
    "*/api/lists/:listId/todos",
    async ({ params, request }) => {
      await delay();
      const list = db.findList(params.listId);
      if (!list) return notFound("List");
      const { text } = await request.json();
      if (!text?.trim()) return invalid("text is required");
      return HttpResponse.json<Todo>(db.addTodo(list, text.trim()), { status: 201 });
    },
  ),

  http.patch<{ todoId: string }, TodoUpdate>("*/api/todos/:todoId", async ({ params, request }) => {
    await delay();
    const todo = db.findTodo(params.todoId);
    if (!todo) return notFound("Todo");
    const { done } = await request.json();
    todo.done = done;
    return HttpResponse.json<Todo>(todo);
  }),
];
