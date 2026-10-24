import { env } from "#/env";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String(body.message)
        : `Request failed with status ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function resolveUrl(url: string) {
  const base = env.VITE_API_URL ?? globalThis.location?.origin;
  return base ? new URL(url, base).toString() : url;
}

/**
 * Fetch function used by the orval-generated client. Returns the
 * `{ data, status, headers }` envelope the generated types expect and throws
 * `ApiError` on non-2xx so React Query treats them as errors.
 */
export async function customFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(resolveUrl(url), {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) throw new ApiError(response.status, data);

  return { data, status: response.status, headers: response.headers } as T;
}
