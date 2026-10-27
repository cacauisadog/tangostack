import { createQueryClient } from "#/api/queryClient";

export function getContext() {
  const queryClient = createQueryClient();

  return {
    queryClient,
  };
}
export default function TanstackQueryProvider() {}
