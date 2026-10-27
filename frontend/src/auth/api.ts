import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthApiError, authFetch } from "#/api/authFetcher";
import type { AuthenticatedResponse, AuthUser, Credentials } from "./types";

// SKETCH: replaced by the generated hooks in `src/api/generated/auth` once the backend exists.
const BASE = "/_allauth/browser/v1/auth";

export const sessionKey = ["auth", "session"] as const;

type Envelope<T> = { data: T; status: number };

/** The signed-in user, or `null` when logged out (allauth answers 401, which isn't an error here). */
async function fetchSession(): Promise<AuthUser | null> {
  try {
    const res = await authFetch<Envelope<AuthenticatedResponse>>(`${BASE}/session`);
    return res.data.data.user;
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
  return (user: AuthUser | null) => {
    // keep the session query itself: mounted observers are attached to it
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
    queryClient.setQueryData(sessionKey, user);
  };
}

function useCredentialsMutation(path: "login" | "signup") {
  const startSession = useStartSession();
  return useMutation<AuthUser, AuthApiError, Credentials>({
    mutationFn: async (credentials) => {
      const res = await authFetch<Envelope<AuthenticatedResponse>>(`${BASE}/${path}`, {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      return res.data.data.user;
    },
    onSuccess: startSession,
  });
}

export const useLogin = () => useCredentialsMutation("login");
export const useSignup = () => useCredentialsMutation("signup");

export function useLogout() {
  const startSession = useStartSession();
  return useMutation<null, AuthApiError, void>({
    mutationFn: async () => {
      try {
        await authFetch(`${BASE}/session`, { method: "DELETE" });
      } catch (error) {
        // allauth answers a successful logout with 401 ("no longer authenticated")
        if (!(error instanceof AuthApiError && error.status === 401)) throw error;
      }
      return null;
    },
    onSuccess: startSession,
  });
}
