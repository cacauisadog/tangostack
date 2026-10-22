export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoList {
  id: string;
  name: string;
  todos: Todo[];
}
