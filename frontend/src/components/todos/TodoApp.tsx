import { useQueryClient } from "@tanstack/react-query";
import {
  getListListsQueryKey,
  useCreateList,
  useCreateTodo,
  useListLists,
  useUpdateTodo,
} from "#/api/generated";
import type { listListsResponse } from "#/api/generated";
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
  } = useListLists({ query: { select: (res) => res.data } });

  const createList = useCreateList({ mutation: { onSuccess: invalidateLists } });
  const createTodo = useCreateTodo({ mutation: { onSuccess: invalidateLists } });

  // Toggling is optimistic: patch the cache now, roll back if the request fails.
  const updateTodo = useUpdateTodo({
    mutation: {
      onMutate: async ({ todoId, data }) => {
        await queryClient.cancelQueries({ queryKey: listsKey });
        const previous = queryClient.getQueryData<listListsResponse>(listsKey);
        queryClient.setQueryData<listListsResponse>(
          listsKey,
          (old) =>
            old && {
              ...old,
              data: old.data.map((list) => ({
                ...list,
                todos: list.todos.map((todo) =>
                  todo.id === todoId ? { ...todo, done: data.done ?? todo.done } : todo,
                ),
              })),
            },
        );
        return { previous };
      },
      onError: (_error, _vars, context) => {
        queryClient.setQueryData(listsKey, context?.previous);
      },
      onSettled: invalidateLists,
    },
  });

  const mutationError = createList.error ?? createTodo.error ?? updateTodo.error;

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
              onAddTodo={(text) => createTodo.mutate({ listId: list.id, data: { text } })}
              onToggleTodo={(todoId) => {
                const todo = list.todos.find((t) => t.id === todoId);
                if (todo) updateTodo.mutate({ todoId, data: { done: !todo.done } });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
