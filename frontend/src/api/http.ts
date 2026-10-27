import { env } from "#/env";
import { isMockingEnabled, reactivateMocking } from "#/mocks/enable";

/** Base of every error thrown by a fetcher. `body` is the parsed JSON response. */
export class HttpError<TBody = unknown> extends Error {
  status: number;
  body: TBody;

  constructor(status: number, body: TBody, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

/** Builds the error a fetcher throws; `message` is set when the response wasn't JSON. */
export type ErrorFactory = (status: number, body: unknown, message?: string) => HttpError;

function resolveUrl(url: string) {
  const base = env.VITE_API_URL ?? globalThis.location?.origin;
  return base ? new URL(url, base).toString() : url;
}

function csrfToken() {
  return globalThis.document?.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1];
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function notJsonMessage(url: string, response: Response) {
  const received = response.headers.get("content-type") || "no content type";
  const hint = isMockingEnabled()
    ? "API mocking is on: is the MSW worker controlling this page? Check navigator.serviceWorker.controller in the console, then do a normal reload."
    : "Is the API reachable? Check VITE_API_URL.";
  return `Expected JSON from ${url} but got ${received} (HTTP ${response.status}). ${hint}`;
}

async function send(url: string, options?: RequestInit) {
  // Django's session auth needs the CSRF token echoed back on unsafe methods.
  const token = SAFE_METHODS.has((options?.method ?? "GET").toUpperCase())
    ? undefined
    : csrfToken();
  const response = await fetch(resolveUrl(url), {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-CSRFToken": token } : {}),
      ...options?.headers,
    },
  });
  const text = await response.text();
  const isJson = !text || (response.headers.get("content-type")?.includes("json") ?? false);
  return { response, text, isJson };
}

/**
 * Shared core of the orval mutators. Returns the `{ data, status, headers }`
 * envelope the generated types expect and throws `makeError(...)` on non-2xx
 * so React Query treats them as errors.
 *
 * With mocking on, a non-JSON response usually means the mock worker was
 * restarted by the browser and let the request through; re-activate it and retry once.
 */
export async function request<T>(
  url: string,
  options: RequestInit | undefined,
  makeError: ErrorFactory,
): Promise<T> {
  let result = await send(url, options);

  if (!result.isJson && isMockingEnabled() && (await reactivateMocking())) {
    result = await send(url, options);
  }

  const { response, text, isJson } = result;
  if (!isJson) throw makeError(response.status, undefined, notJsonMessage(url, response));

  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw makeError(response.status, data);

  return { data, status: response.status, headers: response.headers } as T;
}
