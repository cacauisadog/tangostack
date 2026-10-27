import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthApiError } from "#/api/authFetcher";
import {
  getGetSessionQueryKey,
  getSession,
  useLogin as useGeneratedLogin,
  useLogout as useGeneratedLogout,
  useSignup as useGeneratedSignup,
} from "#/api/generated-auth";
import type { User } from "#/api/generated-auth";

export const sessionKey = getGetSessionQueryKey();

/** The signed-in user, or `null` when logged out (allauth answers 401, which isn't an error here). */
async function fetchSession(): Promise<User | null> {
  try {
    const res = await getSession();
    return res.status === 200 ? res.data.data.user : null;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) return null;
    throw error;
  }
}

export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: Infinity });
}

/** Forget everything cached for the previous user, then store the new session. */
function useStartSession() {
  const queryClient = useQueryClient();
  return (user: User | null) => {
    // keep the session query itself: mounted observers are attached to it
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
    queryClient.setQueryData(sessionKey, user);
  };
}

export function useLogin() {
  const startSession = useStartSession();
  return useGeneratedLogin({
    mutation: { onSuccess: (res) => startSession(res.status === 200 ? res.data.data.user : null) },
  });
}

export function useSignup() {
  const startSession = useStartSession();
  return useGeneratedSignup({
    mutation: { onSuccess: (res) => startSession(res.status === 200 ? res.data.data.user : null) },
  });
}

export function useLogout() {
  const startSession = useStartSession();
  return useGeneratedLogout({
    mutation: {
      // allauth answers a successful logout with 401 ("no longer authenticated")
      onError: (error) => {
        if (error instanceof AuthApiError && error.status === 401) startSession(null);
      },
    },
  });
}
