import { execFileSync } from "node:child_process";
import { test as base, expect } from "@playwright/test";
import type { APIRequestContext, APIResponse } from "@playwright/test";

export const PASSWORD = "a-good-password";
const AUTH = "/_allauth/browser/v1/auth";

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

/** Creates an account through the API and leaves `request` (and its browser context) signed in. */
export async function signUp(request: APIRequestContext, email: string) {
  const api = csrfApi(request);
  await api.get(`${AUTH}/session`); // sets the csrftoken cookie (401 is expected)
  const response = await api.post(`${AUTH}/signup`, { data: { email, password: PASSWORD } });
  expect(response.status()).toBe(200);
}

export const test = base.extend<{ cleanDatabase: void; api: Api }>({
  cleanDatabase: [
    // Playwright needs the destructured first argument, even when empty
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      // Every test starts from an empty e2e database (users included).
      execFileSync("make", ["-s", "-C", "..", "e2e-flush"], { stdio: "pipe" });
      await use();
    },
    { auto: true },
  ],
  // The API as a signed-in user whose session the browser page shares.
  api: async ({ page }, use) => {
    await signUp(page.request, "amanda@email.com");
    await use(csrfApi(page.request));
  },
});

export { expect };
