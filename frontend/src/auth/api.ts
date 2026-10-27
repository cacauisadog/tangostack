import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { AuthApiError } from "#/api/authFetcher";
import { csrfToken } from "#/api/http";
import {
  getGetSessionQueryKey,
  getSession,
  useLogin as useGeneratedLogin,
  useLogout as useGeneratedLogout,
  useSignup as useGeneratedSignup,
} from "#/api/generated-auth";
import type { Flow, User } from "#/api/generated-auth";
import { isMockingEnabled } from "#/mocks/enable";

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

/** Where the backend sends the browser back to after the provider handshake. */
export const SOCIAL_CALLBACK_PATH = "/auth/callback";

const SOCIAL_REDIRECT_URL = "/_allauth/browser/v1/auth/provider/redirect";

/** `Flow` plus the `providers` ids that allauth really sends but the spec's type lacks. */
export type ProviderFlow = Flow & { providers?: string[] };

/**
 * Ids of the providers the backend offers for the redirect flow (only those with
 * credentials configured). They come with the logged-out session response. The
 * spec's `Flow` type lacks the `providers` list that allauth really sends.
 */
async function fetchSocialProviders(): Promise<string[]> {
  try {
    await getSession();
    return []; // already signed in
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401) throw error;
    const flows = (error.body as { data?: { flows?: ProviderFlow[] } }).data?.flows;
    return flows?.find((flow) => flow.id === "provider_redirect")?.providers ?? [];
  }
}

export function useSocialProviders() {
  return useQuery({
    queryKey: [sessionKey[0], "providers"],
    queryFn: fetchSocialProviders,
    staleTime: Infinity,
  });
}

/**
 * Starts the provider handshake. allauth's redirect endpoint answers with a 302
 * to the provider, so it must be a real form post (not XHR). With mocking on
 * there's no provider: the mock endpoint signs in and we land on the callback.
 */
export function useSocialLogin() {
  const navigate = useNavigate();
  return async (provider: string) => {
    const fields = {
      provider,
      process: "login",
      callback_url: `${globalThis.location.origin}${SOCIAL_CALLBACK_PATH}`,
    };
    if (isMockingEnabled()) {
      await fetch(SOCIAL_REDIRECT_URL, { method: "POST", body: new URLSearchParams(fields) });
      await navigate({ to: SOCIAL_CALLBACK_PATH });
      return;
    }
    const form = document.createElement("form");
    form.method = "POST";
    form.action = SOCIAL_REDIRECT_URL;
    for (const [name, value] of Object.entries({
      ...fields,
      csrfmiddlewaretoken: csrfToken() ?? "",
    })) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
  };
}

/** After returning from a provider: drop the cache of the previous visitor and reload the session. */
export function useRefreshSession() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
    await queryClient.refetchQueries({ queryKey: sessionKey });
  }, [queryClient]);
}
