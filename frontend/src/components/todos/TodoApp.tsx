import { useQueryClient } from "@tanstack/react-query";
import {
  getListListsQueryKey,
  useCreateList,
  useCreateTodo,
  useDeleteList,
  useDeleteTodo,
  useListLists,
  useUpdateList,
  useUpdateTodo,
} from "#/api/generated";
import type { TodoListResponse, listListsResponse } from "#/api/generated";
import InlineForm from "./InlineForm";
import TodoListCard from "./TodoListCard";

export default function TodoApp() {
  const queryClient = useQueryClient();
  const listsKey = getListListsQueryKey();
  const invalidateLists = () => queryClient.invalidateQueries({ queryKey: listsKey });

  const {
    data: lists,
    isPending,
    isError,
  } = useListLists({ query: { select: (res) => (res.status === 200 ? res.data : []) } });

  const createList = useCreateList({ mutation: { onSuccess: invalidateLists } });
  const createTodo = useCreateTodo({ mutation: { onSuccess: invalidateLists } });

  // Edits, toggles and deletes are optimistic: patch the cache now, roll back if the request fails.
  function optimistic<TVariables>(
    apply: (lists: TodoListResponse[], vars: TVariables) => TodoListResponse[],
  ) {
    return {
      onMutate: async (vars: TVariables) => {
        await queryClient.cancelQueries({ queryKey: listsKey });
        const previous = queryClient.getQueryData<listListsResponse>(listsKey);
        queryClient.setQueryData<listListsResponse>(listsKey, (old) =>
          old?.status === 200 ? { ...old, data: apply(old.data, vars) } : old,
        );
        return { previous };
      },
      onError: (_error: Error, _vars: TVariables, context?: { previous?: listListsResponse }) => {
        queryClient.setQueryData(listsKey, context?.previous);
      },
      onSettled: invalidateLists,
    };
  }

  const updateList = useUpdateList({
    mutation: optimistic((all, { listId, data }) =>
      all.map((list) => (list.id === listId ? { ...list, ...data } : list)),
    ),
  });
  const deleteList = useDeleteList({
    mutation: optimistic((all, { listId }) => all.filter((list) => list.id !== listId)),
  });
  const updateTodo = useUpdateTodo({
    mutation: optimistic((all, { todoId, data }) =>
      all.map((list) => ({
        ...list,
        todos: list.todos.map((todo) => (todo.id === todoId ? { ...todo, ...data } : todo)),
      })),
    ),
  });
  const deleteTodo = useDeleteTodo({
    mutation: optimistic((all, { todoId }) =>
      all.map((list) => ({ ...list, todos: list.todos.filter((todo) => todo.id !== todoId) })),
    ),
  });

  const mutationError =
    createList.error ??
    createTodo.error ??
    updateList.error ??
    deleteList.error ??
    updateTodo.error ??
    deleteTodo.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="m-0 text-3xl font-bold tracking-tight">My lists</h1>
        <InlineForm
          triggerLabel="New list"
          placeholder="List name"
          submitLabel="Create"
          onSubmit={(name) => createList.mutate({ data: { name } })}
        />
      </div>

      {mutationError && (
        <p role="alert" className="text-destructive">
          {mutationError.message}
        </p>
      )}

      {isPending ? (
        <p className="text-muted-foreground">Loading lists…</p>
      ) : isError ? (
        <p role="alert" className="text-destructive">
          Couldn't load your lists. Try again in a moment.
        </p>
      ) : lists.length === 0 ? (
        <p className="text-muted-foreground">No lists yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {lists.map((list) => (
            <TodoListCard
              key={list.id}
              list={list}
              onRename={(name) => updateList.mutate({ listId: list.id, data: { name } })}
              onDelete={() => deleteList.mutate({ listId: list.id })}
              onAddTodo={(text) => createTodo.mutate({ listId: list.id, data: { text } })}
              onToggleTodo={(todoId) => {
                const todo = list.todos.find((t) => t.id === todoId);
                if (todo) updateTodo.mutate({ todoId, data: { done: !todo.done } });
              }}
              onEditTodo={(todoId, text) => updateTodo.mutate({ todoId, data: { text } })}
              onDeleteTodo={(todoId) => deleteTodo.mutate({ todoId })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
