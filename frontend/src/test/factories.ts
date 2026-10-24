import type { TodoListResponse, TodoResponse } from "#/api/generated/model";

const TIMESTAMP = "2026-01-01T12:00:00.000Z";

/** A valid `TodoResponse`; override only what the test cares about. */
export function todo(overrides: Partial<TodoResponse> = {}): TodoResponse {
  return {
    id: crypto.randomUUID(),
    text: "A task",
    done: false,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

/** A valid `TodoListResponse`; override only what the test cares about. */
export function todoList(overrides: Partial<TodoListResponse> = {}): TodoListResponse {
  return {
    id: crypto.randomUUID(),
    name: "A list",
    todos: [],
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}
