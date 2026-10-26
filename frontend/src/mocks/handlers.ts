import { delay, http, HttpResponse } from "msw";
import type {
  ErrorResponse,
  TodoCreate,
  TodoListCreate,
  TodoListResponse,
  TodoListUpdate,
  TodoResponse,
  TodoUpdate,
  ValidationErrorItem,
  ValidationErrorResponse,
} from "#/api/generated/model";
import { db } from "./db";

// Ninja-shaped errors: 404 is `{ detail: "Not Found" }`, 422 is a `detail` list.
const notFound = () => HttpResponse.json<ErrorResponse>({ detail: "Not Found" }, { status: 404 });
const unprocessable = (...issues: ValidationErrorItem[]) =>
  HttpResponse.json<ValidationErrorResponse>({ detail: issues }, { status: 422 });

// Same limits as the backend columns (also present as maxLength in the spec).
const MAX_NAME_LENGTH = 255;
const MAX_TEXT_LENGTH = 500;

/** Mirrors the backend's `strip_whitespace`, `min_length` and `max_length` rules. */
function requiredString(field: string, value: unknown, maxLength: number) {
  const loc = ["body", "payload", field];
  if (value === undefined) return { issue: { type: "missing", loc, msg: "Field required" } };
  if (typeof value !== "string") {
    return { issue: { type: "string_type", loc, msg: "Input should be a valid string" } };
  }
  const trimmed = value.trim();
  if (trimmed.length < 1) {
    return {
      issue: {
        type: "string_too_short",
        loc,
        msg: "String should have at least 1 character",
        ctx: { min_length: 1 },
      },
    };
  }
  if (trimmed.length > maxLength) {
    return {
      issue: {
        type: "string_too_long",
        loc,
        msg: `String should have at most ${maxLength} characters`,
        ctx: { max_length: maxLength },
      },
    };
  }
  return { value: trimmed };
}

/** One handler per operation in the backend's OpenAPI spec (api/openapi.json). */
export const handlers = [
  http.get("*/api/lists", async () => {
    await delay();
    return HttpResponse.json<TodoListResponse[]>(db.getLists());
  }),

  http.post<never, Partial<TodoListCreate>>("*/api/lists", async ({ request }) => {
    await delay();
    const name = requiredString("name", (await request.json()).name, MAX_NAME_LENGTH);
    if (name.issue) return unprocessable(name.issue);
    return HttpResponse.json<TodoListResponse>(db.addList(name.value), { status: 201 });
  }),

  http.post<{ listId: string }, Partial<TodoCreate>>(
    "*/api/lists/:listId/todos",
    async ({ params, request }) => {
      await delay();
      // Like Ninja, validate the body before looking the list up.
      const text = requiredString("text", (await request.json()).text, MAX_TEXT_LENGTH);
      if (text.issue) return unprocessable(text.issue);
      const list = db.findList(params.listId);
      if (!list) return notFound();
      return HttpResponse.json<TodoResponse>(db.addTodo(list, text.value), { status: 201 });
    },
  ),

  http.patch<{ listId: string }, TodoListUpdate>(
    "*/api/lists/:listId",
    async ({ params, request }) => {
      await delay();
      const body = await request.json();
      // Omitted fields are left alone; an explicit `null` is rejected like in the backend.
      const name = "name" in body ? requiredString("name", body.name, MAX_NAME_LENGTH) : undefined;
      if (name?.issue) return unprocessable(name.issue);
      const list = db.findList(params.listId);
      if (!list) return notFound();
      return HttpResponse.json<TodoListResponse>(
        db.updateList(list, name ? { name: name.value } : {}),
      );
    },
  ),

  http.delete<{ listId: string }>("*/api/lists/:listId", async ({ params }) => {
    await delay();
    const list = db.findList(params.listId);
    if (!list) return notFound();
    db.deleteList(list);
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch<{ todoId: string }, TodoUpdate>("*/api/todos/:todoId", async ({ params, request }) => {
    await delay();
    const body = await request.json();
    const text = "text" in body ? requiredString("text", body.text, MAX_TEXT_LENGTH) : undefined;
    if (text?.issue) return unprocessable(text.issue);
    if ("done" in body && typeof body.done !== "boolean") {
      return unprocessable(
        body.done === null
          ? {
              type: "bool_type",
              loc: ["body", "payload", "done"],
              msg: "Input should be a valid boolean",
            }
          : {
              type: "bool_parsing",
              loc: ["body", "payload", "done"],
              msg: "Input should be a valid boolean, unable to interpret input",
            },
      );
    }
    const todo = db.findTodo(params.todoId);
    if (!todo) return notFound();
    return HttpResponse.json<TodoResponse>(
      db.updateTodo(todo, {
        ...(text && { text: text.value }),
        ...("done" in body && { done: body.done }),
      }),
    );
  }),

  http.delete<{ todoId: string }>("*/api/todos/:todoId", async ({ params }) => {
    await delay();
    const todo = db.findTodo(params.todoId);
    if (!todo) return notFound();
    db.deleteTodo(todo);
    return new HttpResponse(null, { status: 204 });
  }),
];
