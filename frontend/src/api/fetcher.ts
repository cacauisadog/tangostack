import { HttpError, request } from "./http";

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

/** Error for our Django Ninja API (`{ detail }` bodies). */
export class ApiError<TBody = unknown> extends HttpError<TBody> {
  constructor(status: number, body: TBody, message?: string) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? (body.detail as ErrorDetail)
        : undefined;
    super(
      status,
      body,
      message ?? (detail ? describeDetail(detail) : `Request failed with status ${status}`),
    );
    this.name = "ApiError";
  }
}

/** Orval uses this as the `error` type of the generated hooks. */
export type ErrorType<TBody> = ApiError<TBody>;

/** Fetch function used by the orval-generated client for the Ninja API. */
export function customFetch<T>(url: string, options?: RequestInit): Promise<T> {
  return request<T>(url, options, (status, body, message) => new ApiError(status, body, message));
}
