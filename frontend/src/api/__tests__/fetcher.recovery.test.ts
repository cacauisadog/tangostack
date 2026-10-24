import { http, HttpResponse } from "msw";
import { beforeEach, expect, test, vi } from "vitest";
import { server } from "#/mocks/server";

const reactivateMocking = vi.fn<() => Promise<boolean>>();
let mockingEnabled = true;
vi.mock("#/mocks/enable", () => ({
  isMockingEnabled: () => mockingEnabled,
  reactivateMocking: () => reactivateMocking(),
}));

const { ApiError, customFetch } = await import("../fetcher");

const html = () =>
  new HttpResponse("<!DOCTYPE html>", { status: 404, headers: { "content-type": "text/html" } });

// First request is "bypassed" (HTML from the dev server), later ones are mocked.
function bypassOnce() {
  let calls = 0;
  server.use(
    http.post("*/api/ping", async ({ request }) => {
      calls++;
      const body = await request.json();
      return calls === 1 ? html() : HttpResponse.json({ received: body });
    }),
  );
  return () => calls;
}

beforeEach(() => {
  mockingEnabled = true;
  reactivateMocking.mockReset();
});

test("re-activates the worker and retries once when a request bypassed the mocks", async () => {
  reactivateMocking.mockResolvedValue(true);
  const calls = bypassOnce();

  const result = await customFetch<{ data: unknown }>("/api/ping", {
    method: "POST",
    body: JSON.stringify({ a: 1 }),
  });

  expect(result.data).toEqual({ received: { a: 1 } });
  expect(reactivateMocking).toHaveBeenCalledOnce();
  expect(calls()).toBe(2);
});

test("throws the clear error when re-activation isn't possible", async () => {
  reactivateMocking.mockResolvedValue(false);
  const calls = bypassOnce();

  const error = await customFetch("/api/ping", { method: "POST", body: "{}" }).catch(
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(ApiError);
  expect((error as Error).message).toMatch(/Expected JSON from \/api\/ping/);
  expect(calls()).toBe(1);
});

test("only retries once", async () => {
  reactivateMocking.mockResolvedValue(true);
  server.use(http.get("*/api/ping", html));

  const error = await customFetch("/api/ping").catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiError);
  expect(reactivateMocking).toHaveBeenCalledOnce();
});

test("does not touch the worker when mocking is off", async () => {
  mockingEnabled = false;
  server.use(http.get("*/api/ping", html));

  await customFetch("/api/ping").catch(() => {});

  expect(reactivateMocking).not.toHaveBeenCalled();
});
