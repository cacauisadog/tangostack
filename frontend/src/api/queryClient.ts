import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { sessionKey } from "#/auth/api";
import { ApiError } from "./fetcher";
import { HttpError } from "./http";

const MAX_RETRIES = 3;

/** Client errors (4xx) won't change on retry; only retry network and 5xx failures. */
function shouldRetry(failureCount: number, error: Error) {
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

/**
 * The app's QueryClient. A 401 from the API means the session is gone (expired,
 * or logged out elsewhere), so mark it logged out and `AuthGate` redirects to /login.
 * Only the Ninja API counts: allauth's own 401s are handled where they're made.
 */
export function createQueryClient({
  retry = shouldRetry,
}: { retry?: false | typeof shouldRetry } = {}) {
  const onError = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) {
      queryClient.setQueryData(sessionKey, null);
    }
  };
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: { queries: { retry }, mutations: { retry: false } },
  });
  return queryClient;
}
