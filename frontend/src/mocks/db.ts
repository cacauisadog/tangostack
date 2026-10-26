import type { TodoListResponse, TodoResponse } from "#/api/generated/model";

/**
 * In-memory "database" behind the MSW handlers. Typed with the generated API
 * models, so a contract change that this seed data doesn't match fails typecheck.
 * Edit the seed freely; it only lives until the page is reloaded.
 */
export const seedLists: TodoListResponse[] = [
  {
    id: "5d1b2a0e-7c34-4a51-9a52-0b1f4f6d9a01",
    name: "Work",
    created_at: "2026-10-20T09:00:00.000Z",
    updated_at: "2026-10-20T09:00:00.000Z",
    todos: [
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c01",
        text: "Review pull requests",
        done: true,
        created_at: "2026-10-20T09:05:00.000Z",
        updated_at: "2026-10-21T08:30:00.000Z",
      },
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c02",
        text: "Write the Q4 planning doc",
        done: false,
        created_at: "2026-10-20T09:10:00.000Z",
        updated_at: "2026-10-20T09:10:00.000Z",
      },
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c03",
        text: "Reply to Marina about the API",
        done: false,
        created_at: "2026-10-20T09:12:00.000Z",
        updated_at: "2026-10-20T09:12:00.000Z",
      },
    ],
  },
  {
    id: "5d1b2a0e-7c34-4a51-9a52-0b1f4f6d9a02",
    name: "Groceries",
    created_at: "2026-10-21T18:00:00.000Z",
    updated_at: "2026-10-21T18:00:00.000Z",
    todos: [
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c11",
        text: "Coffee beans",
        done: false,
        created_at: "2026-10-21T18:01:00.000Z",
        updated_at: "2026-10-21T18:01:00.000Z",
      },
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c12",
        text: "Oat milk",
        done: true,
        created_at: "2026-10-21T18:02:00.000Z",
        updated_at: "2026-10-22T07:45:00.000Z",
      },
    ],
  },
];

function clone(lists: TodoListResponse[]): TodoListResponse[] {
  return structuredClone(lists);
}

const now = () => new Date().toISOString();

let lists: TodoListResponse[] = clone(seedLists);

export const db = {
  /** Replace all data. Defaults to the seed; tests pass `[]` for a blank slate. */
  reset(next: TodoListResponse[] = seedLists) {
    lists = clone(next);
  },

  getLists(): TodoListResponse[] {
    return lists;
  },

  findList(listId: string): TodoListResponse | undefined {
    return lists.find((list) => list.id === listId);
  },

  findTodo(todoId: string): TodoResponse | undefined {
    return lists.flatMap((list) => list.todos).find((todo) => todo.id === todoId);
  },

  addList(name: string): TodoListResponse {
    const timestamp = now();
    const list: TodoListResponse = {
      id: crypto.randomUUID(),
      name,
      todos: [],
      created_at: timestamp,
      updated_at: timestamp,
    };
    lists.push(list);
    return list;
  },

  addTodo(list: TodoListResponse, text: string): TodoResponse {
    const timestamp = now();
    const todo: TodoResponse = {
      id: crypto.randomUUID(),
      text,
      done: false,
      created_at: timestamp,
      updated_at: timestamp,
    };
    list.todos.push(todo);
    return todo;
  },

  updateList(list: TodoListResponse, changes: Partial<Pick<TodoListResponse, "name">>) {
    Object.assign(list, changes, { updated_at: now() });
    return list;
  },

  deleteList(list: TodoListResponse) {
    lists = lists.filter((candidate) => candidate !== list);
  },

  updateTodo(
    todo: TodoResponse,
    changes: Partial<Pick<TodoResponse, "text" | "done">>,
  ): TodoResponse {
    Object.assign(todo, changes, { updated_at: now() });
    return todo;
  },

  deleteTodo(todo: TodoResponse) {
    for (const list of lists) list.todos = list.todos.filter((candidate) => candidate !== todo);
  },
};
