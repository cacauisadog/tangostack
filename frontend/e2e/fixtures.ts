import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import type { APIRequestContext, APIResponse } from "@playwright/test";

export const PASSWORD = "a-good-password";
const AUTH = "/_allauth/browser/v1/auth";

// The e2e backend sends its email to this Mailpit (the `mailpit-e2e` container).
const MAILPIT = "http://localhost:8026/api/v1";

/**
 * A fresh address per call. allauth rate-limits confirmation emails per address
 * (one every few minutes), which the e2e backend, a single long-lived process,
 * would hit as soon as two tests used the same one.
 */
export function uniqueEmail(name: string) {
  return `${name}.${randomUUID().slice(0, 8)}@email.com`;
}

/**
 * Waits for the email to `to` in Mailpit and returns the path (and key) of the
 * frontend link in it, e.g. `/auth/verify-email/<key>`. The link's host is whatever
 * the backend saw, so only its path is used.
 */
export async function emailedLink(to: string, page: "verify-email" | "reset-password") {
  const search = `${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}`;
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const { messages } = (await (await fetch(search)).json()) as { messages: { ID: string }[] };
        id = messages[0]?.ID;
        return id;
      },
      { message: `no email for ${to} in Mailpit`, timeout: 15_000 },
    )
    .toBeTruthy();
  const { Text } = (await (await fetch(`${MAILPIT}/message/${id}`)).json()) as { Text: string };
  const path = new RegExp(`/auth/${page}/\\S+`).exec(Text)?.[0];
  expect(path, `no ${page} link in the email to ${to}:\n${Text}`).toBeTruthy();
  return path!;
}

/** The key part of a link returned by `emailedLink`, as the API wants it. */
export const linkKey = (path: string) => decodeURIComponent(path.split("/").pop()!);

type Options = Parameters<APIRequestContext["post"]>[1];

/** Like `APIRequestContext`, but sends Django's CSRF token on every call. */
export interface Api {
  get(url: string, options?: Options): Promise<APIResponse>;
  post(url: string, options?: Options): Promise<APIResponse>;
  patch(url: string, options?: Options): Promise<APIResponse>;
  delete(url: string, options?: Options): Promise<APIResponse>;
}

export function csrfApi(request: APIRequestContext): Api {
  const call =
    (method: "get" | "post" | "patch" | "delete") =>
    async (url: string, options: Options = {}) => {
      const { cookies } = await request.storageState();
      const csrf = cookies.find((cookie) => cookie.name === "csrftoken")?.value;
      return request[method](url, {
        ...options,
        headers: { ...(csrf ? { "X-CSRFToken": csrf } : {}), ...options.headers },
      });
    };
  return { get: call("get"), post: call("post"), patch: call("patch"), delete: call("delete") };
}

/**
 * Creates an account through the API, confirms its address with the emailed link,
 * and leaves `request` (and its browser context) signed in.
 */
export async function signUp(request: APIRequestContext, email: string) {
  const api = csrfApi(request);
  await api.get(`${AUTH}/session`); // sets the csrftoken cookie (401 is expected)
  // 401: the address still has to be confirmed
  const signup = await api.post(`${AUTH}/signup`, { data: { email, password: PASSWORD } });
  expect(signup.status()).toBe(401);
  const key = linkKey(await emailedLink(email, "verify-email"));
  // 401 again: confirmed, but not signed in
  const verify = await api.post(`${AUTH}/email/verify`, { data: { key } });
  expect(verify.status()).toBe(401);
  const login = await api.post(`${AUTH}/login`, { data: { email, password: PASSWORD } });
  expect(login.status()).toBe(200);
}

export const test = base.extend<{ cleanDatabase: void; api: Api }>({
  cleanDatabase: [
    // Playwright needs the destructured first argument, even when empty
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      // Every test starts from an empty e2e database (users included).
      execFileSync("make", ["-s", "-C", "..", "e2e-flush"], { stdio: "pipe" });
      await fetch(`${MAILPIT}/messages`, { method: "DELETE" });
      await use();
    },
    { auto: true },
  ],
  // The API as a signed-in user whose session the browser page shares.
  api: async ({ page }, use) => {
    await signUp(page.request, uniqueEmail("amanda"));
    await use(csrfApi(page.request));
  },
});

export { expect };
