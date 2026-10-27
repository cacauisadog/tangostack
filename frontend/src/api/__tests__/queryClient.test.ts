import { QueryObserver } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { sessionKey } from "#/auth/api";
import { AuthApiError } from "../authFetcher";
import { ApiError } from "../fetcher";
import { createQueryClient } from "../queryClient";

const user = { id: 1, display: "Amanda", email: "amanda@email.com", has_usable_password: true };

async function failWith(error: Error, retry?: false) {
  const client = createQueryClient(retry === false ? { retry } : {});
  client.setQueryData(sessionKey, user);
  let calls = 0;
  const observer = new QueryObserver(client, {
    queryKey: ["lists"],
    retryDelay: 0,
    queryFn: () => {
      calls++;
      throw error;
    },
  });
  await new Promise<void>((resolve) => {
    const unsubscribe = observer.subscribe((result) => {
      if (result.isError) {
        unsubscribe();
        resolve();
      }
    });
  });
  return { client, calls };
}

test("a 401 from the API marks the session as logged out", async () => {
  const { client } = await failWith(new ApiError(401, { detail: "Unauthorized" }), false);

  expect(client.getQueryData(sessionKey)).toBeNull();
});

test("other errors leave the session alone, including allauth's own 401s", async () => {
  const notFound = await failWith(new ApiError(404, { detail: "Not Found" }), false);
  const auth = await failWith(new AuthApiError(401, { status: 401 }), false);

  expect(notFound.client.getQueryData(sessionKey)).toEqual(user);
  expect(auth.client.getQueryData(sessionKey)).toEqual(user);
});

test("does not retry client errors", async () => {
  expect((await failWith(new ApiError(401, { detail: "Unauthorized" }))).calls).toBe(1);
  expect((await failWith(new ApiError(404, { detail: "Not Found" }))).calls).toBe(1);
});

test("retries server errors", async () => {
  expect((await failWith(new ApiError(500, { detail: "boom" }))).calls).toBe(4);
});
