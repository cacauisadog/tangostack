import { useState } from 'react'
import InlineForm from './InlineForm'
import TodoListCard from './TodoListCard'
import type { TodoList } from './types'

export default function TodoApp() {
  const [lists, setLists] = useState<TodoList[]>([])

  function addList(name: string) {
    setLists((prev) => [...prev, { id: crypto.randomUUID(), name, todos: [] }])
  }

  function addTodo(listId: string, text: string) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              todos: [
                ...list.todos,
                { id: crypto.randomUUID(), text, done: false },
              ],
            }
          : list,
      ),
    )
  }

  function toggleTodo(listId: string, todoId: string) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              todos: list.todos.map((todo) =>
                todo.id === todoId ? { ...todo, done: !todo.done } : todo,
              ),
            }
          : list,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="m-0 text-3xl font-bold tracking-tight">My lists</h1>
        <InlineForm
          triggerLabel="New list"
          placeholder="List name"
          submitLabel="Create"
          onSubmit={addList}
        />
      </div>

      {lists.length === 0 ? (
        <p className="text-muted-foreground">
          No lists yet. Create one to get started.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {lists.map((list) => (
            <TodoListCard
              key={list.id}
              list={list}
              onAddTodo={(text) => addTodo(list.id, text)}
              onToggleTodo={(todoId) => toggleTodo(list.id, todoId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
