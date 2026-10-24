import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { db } from "#/mocks/db";
import { server } from "#/mocks/server";
import { settleClients } from "./render";

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));

// Tests start from an empty database; seed it per test with `db.reset([...])`.
beforeEach(() => db.reset([]));

afterEach(async () => {
  await settleClients();
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
