import type { TodoListResponse, TodoResponse } from "#/api/generated/model";
import type { User } from "#/api/generated-auth";
import { env } from "#/env";

/** Mock accounts. Both use the password `password`. */
export type MockUser = User & { id: number; email: string; password: string; verified: boolean };

export const seedUsers: MockUser[] = [
  {
    id: 1,
    email: "amanda@email.com",
    display: "Amanda Pepinha",
    has_usable_password: true,
    password: "password",
    verified: true,
  },
  {
    id: 2,
    email: "bruno@email.com",
    display: "Bruno Carnietto",
    has_usable_password: true,
    password: "password",
    verified: true,
  },
];

/**
 * In-memory "database" behind the MSW handlers. Typed with the generated API
 * models, so a contract change that this seed data doesn't match fails typecheck.
 * Edit the seed freely; it only lives until the page is reloaded.
 * Each user only sees their own lists.
 */
const anaLists: TodoListResponse[] = [
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

const brunoLists: TodoListResponse[] = [
  {
    id: "5d1b2a0e-7c34-4a51-9a52-0b1f4f6d9b01",
    name: "Trip to Lisbon",
    created_at: "2026-10-18T20:00:00.000Z",
    updated_at: "2026-10-18T20:00:00.000Z",
    todos: [
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0d01",
        text: "Book the flights",
        done: true,
        created_at: "2026-10-18T20:05:00.000Z",
        updated_at: "2026-10-19T09:00:00.000Z",
      },
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0d02",
        text: "Reserve a table at Time Out Market",
        done: false,
        created_at: "2026-10-18T20:10:00.000Z",
        updated_at: "2026-10-18T20:10:00.000Z",
      },
    ],
  },
  {
    id: "5d1b2a0e-7c34-4a51-9a52-0b1f4f6d9b02",
    name: "Reading",
    created_at: "2026-10-22T21:00:00.000Z",
    updated_at: "2026-10-22T21:00:00.000Z",
    todos: [
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0d11",
        text: "Finish Designing Data-Intensive Applications",
        done: false,
        created_at: "2026-10-22T21:01:00.000Z",
        updated_at: "2026-10-22T21:01:00.000Z",
      },
    ],
  },
];

export const seedLists: Record<number, TodoListResponse[]> = { 1: anaLists, 2: brunoLists };

function clone(lists: TodoListResponse[]): TodoListResponse[] {
  return structuredClone(lists);
}

const now = () => new Date().toISOString();

const SESSION_KEY = "tangostack:mock-session";

/** Opt-in (`VITE_API_MOCKING_KEEP_SESSION`): remember who is signed in across reloads. */
function persistSession(userId: number | null) {
  if (!env.VITE_API_MOCKING_KEEP_SESSION) return;
  try {
    if (userId === null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, String(userId));
  } catch {
    // storage unavailable; the session just won't survive a reload
  }
}

function restoreSession(): number | null {
  if (!env.VITE_API_MOCKING_KEEP_SESSION) return null;
  try {
    const id = Number(localStorage.getItem(SESSION_KEY));
    return seedUsers.some((user) => user.id === id) ? id : null;
  } catch {
    return null;
  }
}

let users: MockUser[] = structuredClone(seedUsers);
let listsByUser = new Map<number, TodoListResponse[]>();
let sessionUserId: number | null = null;

function seed() {
  users = structuredClone(seedUsers);
  listsByUser = new Map(Object.entries(seedLists).map(([id, lists]) => [Number(id), clone(lists)]));
  sessionUserId = restoreSession();
}
seed();

/** The signed-in user's lists. The handlers check the session first. */
function mine(): TodoListResponse[] {
  if (sessionUserId === null) return [];
  let lists = listsByUser.get(sessionUserId);
  if (!lists) listsByUser.set(sessionUserId, (lists = []));
  return lists;
}

export const db = {
  /**
   * With no argument: the dev seed, signed out (or the remembered user, see
   * `persistSession`). With lists: the test setup, signed in as the first
   * seed user with exactly these lists (everyone else starts empty).
   */
  reset(next?: TodoListResponse[]) {
    if (!next) return seed();
    users = structuredClone(seedUsers);
    listsByUser = new Map([[seedUsers[0].id, clone(next)]]);
    sessionUserId = seedUsers[0].id;
  },

  currentUser(): MockUser | undefined {
    return users.find((user) => user.id === sessionUserId);
  },

  findUserByEmail(email: string): MockUser | undefined {
    return users.find((user) => user.email === email.toLowerCase());
  },

  /** New accounts are verified unless they come from password signup, which emails a link first. */
  addUser(email: string, password: string, { verified = true } = {}): MockUser {
    const user: MockUser = {
      id: Math.max(0, ...users.map((candidate) => candidate.id)) + 1,
      email: email.toLowerCase(),
      display: email.split("@")[0],
      has_usable_password: true,
      password,
      verified,
    };
    users.push(user);
    return user;
  },

  signIn(user: MockUser) {
    sessionUserId = user.id;
    persistSession(user.id);
  },

  signOut() {
    sessionUserId = null;
    persistSession(null);
  },

  getLists(): TodoListResponse[] {
    return mine();
  },

  findList(listId: string): TodoListResponse | undefined {
    return mine().find((list) => list.id === listId);
  },

  findTodo(todoId: string): TodoResponse | undefined {
    return mine()
      .flatMap((list) => list.todos)
      .find((todo) => todo.id === todoId);
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
    mine().push(list);
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
    listsByUser.set(
      sessionUserId!,
      mine().filter((candidate) => candidate !== list),
    );
  },

  updateTodo(
    todo: TodoResponse,
    changes: Partial<Pick<TodoResponse, "text" | "done">>,
  ): TodoResponse {
    Object.assign(todo, changes, { updated_at: now() });
    return todo;
  },

  deleteTodo(todo: TodoResponse) {
    for (const list of mine()) list.todos = list.todos.filter((candidate) => candidate !== todo);
  },
};
