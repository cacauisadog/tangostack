import type { Todo, TodoList } from "#/api/generated/model";

/**
 * In-memory "database" behind the MSW handlers. Typed with the generated API
 * models, so a contract change that this seed data doesn't match fails typecheck.
 * Edit the seed freely; it only lives until the page is reloaded.
 */
export const seedLists: TodoList[] = [
  {
    id: "5d1b2a0e-7c34-4a51-9a52-0b1f4f6d9a01",
    name: "Work",
    todos: [
      { id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c01", text: "Review pull requests", done: true },
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c02",
        text: "Write the Q4 planning doc",
        done: false,
      },
      {
        id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c03",
        text: "Reply to Marina about the API",
        done: false,
      },
    ],
  },
  {
    id: "5d1b2a0e-7c34-4a51-9a52-0b1f4f6d9a02",
    name: "Groceries",
    todos: [
      { id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c11", text: "Coffee beans", done: false },
      { id: "b9f1e6c2-3a7d-4c1e-8f20-1d2a5e7b0c12", text: "Oat milk", done: true },
    ],
  },
];

function clone(lists: TodoList[]): TodoList[] {
  return structuredClone(lists);
}

let lists: TodoList[] = clone(seedLists);

export const db = {
  /** Replace all data. Defaults to the seed; tests pass `[]` for a blank slate. */
  reset(next: TodoList[] = seedLists) {
    lists = clone(next);
  },

  getLists(): TodoList[] {
    return lists;
  },

  findList(listId: string): TodoList | undefined {
    return lists.find((list) => list.id === listId);
  },

  findTodo(todoId: string): Todo | undefined {
    return lists.flatMap((list) => list.todos).find((todo) => todo.id === todoId);
  },

  addList(name: string): TodoList {
    const list: TodoList = { id: crypto.randomUUID(), name, todos: [] };
    lists.push(list);
    return list;
  },

  addTodo(list: TodoList, text: string): Todo {
    const todo: Todo = { id: crypto.randomUUID(), text, done: false };
    list.todos.push(todo);
    return todo;
  },
};
