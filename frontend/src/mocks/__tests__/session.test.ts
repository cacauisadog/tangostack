import { afterEach, beforeEach, expect, test, vi } from "vitest";

beforeEach(() => localStorage.clear());

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadDb() {
  vi.resetModules();
  return (await import("../db")).db;
}

test("the mock session is forgotten on reload by default", async () => {
  const first = await loadDb();
  first.signIn(first.findUserByEmail("amanda@email.com")!);

  const second = await loadDb();

  expect(second.currentUser()).toBeUndefined();
});

test("VITE_API_MOCKING_KEEP_SESSION keeps the signed-in user across reloads", async () => {
  vi.stubEnv("VITE_API_MOCKING_KEEP_SESSION", "true");
  const first = await loadDb();
  first.signIn(first.findUserByEmail("bruno@email.com")!);

  const second = await loadDb();
  expect(second.currentUser()?.email).toBe("bruno@email.com");

  second.signOut();
  expect((await loadDb()).currentUser()).toBeUndefined();
});
