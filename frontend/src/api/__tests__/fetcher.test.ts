import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { server } from "#/mocks/server";
import { ApiError, customFetch } from "../fetcher";

test("returns the { data, status, headers } envelope on success", async () => {
  server.use(http.get("*/api/ping", () => HttpResponse.json({ pong: true })));

  const result = await customFetch<{ data: { pong: boolean }; status: number; headers: Headers }>(
    "/api/ping",
  );

  expect(result.data).toEqual({ pong: true });
  expect(result.status).toBe(200);
  expect(result.headers.get("content-type")).toContain("json");
});

test("handles an empty response body", async () => {
  server.use(http.delete("*/api/thing", () => new HttpResponse(null, { status: 204 })));

  const result = await customFetch<{ data: undefined; status: number }>("/api/thing", {
    method: "DELETE",
  });

  expect(result).toMatchObject({ data: undefined, status: 204 });
});

test("sends a JSON content type only when there is a body", async () => {
  const seen: Array<string | null> = [];
  server.use(
    http.get("*/api/ping", ({ request }) => {
      seen.push(request.headers.get("content-type"));
      return HttpResponse.json({});
    }),
    http.post("*/api/ping", ({ request }) => {
      seen.push(request.headers.get("content-type"));
      return HttpResponse.json({});
    }),
  );

  await customFetch("/api/ping");
  await customFetch("/api/ping", { method: "POST", body: JSON.stringify({ a: 1 }) });

  expect(seen[0]).toBeNull();
  expect(seen[1]).toBe("application/json");
});

test("throws ApiError with the API's message on a JSON error response", async () => {
  server.use(http.get("*/api/ping", () => HttpResponse.json({ message: "nope" }, { status: 422 })));

  const error = await customFetch("/api/ping").catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 422, message: "nope", body: { message: "nope" } });
});

test("throws a clear ApiError when the server answers with HTML (e.g. the mock worker is bypassed)", async () => {
  server.use(
    http.get(
      "*/api/ping",
      () =>
        new HttpResponse("<!DOCTYPE html><p>Not Found</p>", {
          status: 404,
          headers: { "content-type": "text/html" },
        }),
    ),
  );

  const error = await customFetch("/api/ping").catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 404 });
  expect((error as ApiError).message).toMatch(
    /Expected JSON from \/api\/ping but got text\/html \(HTTP 404\)/,
  );
  expect((error as ApiError).message).toMatch(/MSW worker/);
  expect((error as ApiError).message).not.toMatch(/Unexpected token/);
});
