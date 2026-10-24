import { env } from "#/env";
import { isMockingEnabled, reactivateMocking } from "#/mocks/enable";

type ErrorDetail = string | Array<{ loc: Array<string | number>; msg: string }>;

/** Turns Ninja's `{ detail }` error bodies into a readable message. */
function describeDetail(detail: ErrorDetail): string {
  if (typeof detail === "string") return detail;
  return detail
    .map(({ loc, msg }) => {
      const field = loc.filter((part) => part !== "body" && part !== "payload").join(".");
      return field ? `${field}: ${msg}` : msg;
    })
    .join("; ");
}

export class ApiError<TBody = unknown> extends Error {
  status: number;
  body: TBody;

  constructor(status: number, body: TBody) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? (body.detail as ErrorDetail)
        : undefined;
    super(detail ? describeDetail(detail) : `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Orval uses this as the `error` type of the generated hooks. */
export type ErrorType<TBody> = ApiError<TBody>;

function resolveUrl(url: string) {
  const base = env.VITE_API_URL ?? globalThis.location?.origin;
  return base ? new URL(url, base).toString() : url;
}

function notJsonError(url: string, response: Response) {
  const received = response.headers.get("content-type") || "no content type";
  const hint = isMockingEnabled()
    ? "API mocking is on: is the MSW worker controlling this page? Check navigator.serviceWorker.controller in the console, then do a normal reload."
    : "Is the API reachable? Check VITE_API_URL.";
  return new ApiError(response.status, {
    detail: `Expected JSON from ${url} but got ${received} (HTTP ${response.status}). ${hint}`,
  });
}

async function send(url: string, options?: RequestInit) {
  const response = await fetch(resolveUrl(url), {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  const text = await response.text();
  const isJson = !text || (response.headers.get("content-type")?.includes("json") ?? false);
  return { response, text, isJson };
}

/**
 * Fetch function used by the orval-generated client. Returns the
 * `{ data, status, headers }` envelope the generated types expect and throws
 * `ApiError` on non-2xx so React Query treats them as errors.
 *
 * With mocking on, a non-JSON response usually means the mock worker was
 * restarted by the browser and let the request through; re-activate it and retry once.
 */
export async function customFetch<T>(url: string, options?: RequestInit): Promise<T> {
  let result = await send(url, options);

  if (!result.isJson && isMockingEnabled() && (await reactivateMocking())) {
    result = await send(url, options);
  }

  const { response, text, isJson } = result;
  if (!isJson) throw notJsonError(url, response);

  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new ApiError(response.status, data);

  return { data, status: response.status, headers: response.headers } as T;
}
