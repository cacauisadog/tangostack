import { HttpError, request } from "./http";

export type AuthErrorBody = {
  status?: number;
  errors?: Array<{ message: string; code?: string; param?: string }>;
};

/**
 * Error for allauth's headless API (`{ status, errors: [{ message, code, param }] }`
 * bodies). `message` joins the messages; `fieldErrors` maps `param` to its
 * messages (space-joined) for inline form errors.
 */
export class AuthApiError<TBody = AuthErrorBody> extends HttpError<TBody> {
  constructor(status: number, body: TBody, message?: string) {
    const errors = (body as AuthErrorBody | undefined)?.errors;
    super(
      status,
      body,
      message ??
        (errors?.length
          ? errors.map((error) => error.message).join("; ")
          : `Request failed with status ${status}`),
    );
    this.name = "AuthApiError";
  }

  get fieldErrors(): Record<string, string> {
    const errors = (this.body as AuthErrorBody | undefined)?.errors ?? [];
    const byParam: Record<string, string[]> = {};
    for (const { param, message } of errors) {
      if (param) (byParam[param] ??= []).push(message);
    }
    return Object.fromEntries(
      Object.entries(byParam).map(([param, all]) => [param, all.join(" ")]),
    );
  }
}

/** Orval uses this as the `error` type of the generated auth hooks. */
export type AuthErrorType<TBody> = AuthApiError<TBody>;

/** Fetch function used by the orval-generated client for allauth. */
export function authFetch<T>(url: string, options?: RequestInit): Promise<T> {
  return request<T>(
    url,
    options,
    (status, body, message) => new AuthApiError(status, body, message),
  );
}
