import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { server } from "#/mocks/server";
import { AuthApiError, authFetch } from "../authFetcher";
import { HttpError } from "../http";

test("returns the { data, status, headers } envelope on success", async () => {
  server.use(
    http.get("*/_allauth/ping", () => HttpResponse.json({ status: 200, data: { ok: true } })),
  );

  const result = await authFetch<{ data: { data: { ok: boolean } }; status: number }>(
    "/_allauth/ping",
  );

  expect(result.data).toEqual({ status: 200, data: { ok: true } });
  expect(result.status).toBe(200);
});

test("throws AuthApiError joining allauth's error messages", async () => {
  const body = {
    status: 400,
    errors: [
      { message: "Enter a valid email address.", code: "invalid", param: "email" },
      { message: "This password is too short.", code: "password_too_short", param: "password" },
    ],
  };
  server.use(http.post("*/_allauth/ping", () => HttpResponse.json(body, { status: 400 })));

  const error = await authFetch("/_allauth/ping", { method: "POST", body: "{}" }).catch(
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(AuthApiError);
  expect(error).toBeInstanceOf(HttpError);
  expect(error).toMatchObject({
    status: 400,
    body,
    message: "Enter a valid email address.; This password is too short.",
  });
});

test("maps errors with a param to fieldErrors and leaves out the rest", async () => {
  server.use(
    http.post("*/_allauth/ping", () =>
      HttpResponse.json(
        {
          status: 400,
          errors: [
            { message: "Taken.", code: "email_taken", param: "email" },
            { message: "Something general." },
          ],
        },
        { status: 400 },
      ),
    ),
  );

  const error = await authFetch("/_allauth/ping", { method: "POST", body: "{}" }).catch(
    (e: unknown) => e,
  );

  expect((error as AuthApiError).fieldErrors).toEqual({ email: "Taken." });
});

test("keeps the body of a 401 that carries flows instead of errors", async () => {
  const body = {
    status: 401,
    data: { flows: [{ id: "login" }] },
    meta: { is_authenticated: false },
  };
  server.use(http.get("*/_allauth/ping", () => HttpResponse.json(body, { status: 401 })));

  const error = await authFetch("/_allauth/ping").catch((e: unknown) => e);

  expect(error).toMatchObject({ status: 401, body, message: "Request failed with status 401" });
  expect((error as AuthApiError).fieldErrors).toEqual({});
});

test("throws a clear AuthApiError when the server answers with HTML", async () => {
  server.use(
    http.get(
      "*/_allauth/ping",
      () =>
        new HttpResponse("<!DOCTYPE html>", {
          status: 404,
          headers: { "content-type": "text/html" },
        }),
    ),
  );

  const error = await authFetch("/_allauth/ping").catch((e: unknown) => e);

  expect(error).toBeInstanceOf(AuthApiError);
  expect((error as AuthApiError).message).toMatch(/Expected JSON from \/_allauth\/ping/);
});

test("joins several messages for the same param", async () => {
  server.use(
    http.post("*/_allauth/ping", () =>
      HttpResponse.json(
        {
          status: 400,
          errors: [
            { message: "Too short.", param: "password" },
            { message: "Entirely numeric.", param: "password" },
          ],
        },
        { status: 400 },
      ),
    ),
  );

  const error = await authFetch("/_allauth/ping", { method: "POST", body: "{}" }).catch(
    (e: unknown) => e,
  );

  expect((error as AuthApiError).fieldErrors).toEqual({ password: "Too short. Entirely numeric." });
});
