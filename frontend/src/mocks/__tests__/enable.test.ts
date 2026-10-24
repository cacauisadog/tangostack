import { afterEach, beforeEach, expect, test, vi } from "vitest";

const start = vi.fn<(options?: unknown) => Promise<void>>();
vi.mock("../browser", () => ({ worker: { start } }));

const reload = vi.fn<() => void>();
let controller: object | null;

beforeEach(() => {
  start.mockResolvedValue(undefined);
  controller = {};
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      get controller() {
        return controller;
      },
    },
    configurable: true,
  });
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load() {
  vi.resetModules();
  return import("../enable");
}

test("does nothing when mocking is turned off", async () => {
  vi.stubEnv("VITE_API_MOCKING", "false");
  const { enableMocking } = await load();

  expect(await enableMocking()).toBe(true);
  expect(start).not.toHaveBeenCalled();
});

test("starts the worker and lets the app hydrate when the page is controlled", async () => {
  const { enableMocking } = await load();

  expect(await enableMocking()).toBe(true);
  expect(start).toHaveBeenCalledOnce();
  expect(reload).not.toHaveBeenCalled();
});

test("reloads once when the worker is active but isn't controlling the page", async () => {
  controller = null;
  const { enableMocking } = await load();

  expect(await enableMocking()).toBe(false);
  expect(reload).toHaveBeenCalledOnce();
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("reloading once"));
});

test("does not reload in a loop: warns the second time", async () => {
  controller = null;
  const { enableMocking } = await load();
  await enableMocking();
  reload.mockClear();

  expect(await enableMocking()).toBe(true);
  expect(reload).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenLastCalledWith(expect.stringContaining("normal reload"));
});

test("resets the reload guard once the page is controlled", async () => {
  controller = null;
  const { enableMocking } = await load();
  await enableMocking(); // reloads, sets the guard

  controller = {};
  await enableMocking(); // controlled again, clears the guard

  controller = null;
  reload.mockClear();
  expect(await enableMocking()).toBe(false); // may reload again
  expect(reload).toHaveBeenCalledOnce();
});

test("still lets the app hydrate when the worker fails to start", async () => {
  start.mockRejectedValue(new Error("registration failed"));
  const { enableMocking } = await load();

  expect(await enableMocking()).toBe(true);
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining("Failed to start"),
    expect.any(Error),
  );
});

function stubServiceWorker(reply: "ack" | "silent") {
  const target = new EventTarget();
  const postMessage = vi.fn<(message: string) => void>((message) => {
    if (message === "MOCK_ACTIVATE" && reply === "ack") {
      const event = Object.assign(new Event("message"), {
        data: { type: "MOCKING_ENABLED" },
        ports: [{ postMessage: vi.fn<(message: unknown) => void>() }],
      });
      queueMicrotask(() => target.dispatchEvent(event));
    }
  });
  Object.defineProperty(navigator, "serviceWorker", {
    value: Object.assign(target, { controller: { postMessage } }),
    configurable: true,
  });
  return postMessage;
}

test("reactivateMocking re-sends MOCK_ACTIVATE and resolves once the worker confirms", async () => {
  const postMessage = stubServiceWorker("ack");
  const { reactivateMocking } = await load();

  expect(await reactivateMocking()).toBe(true);
  expect(postMessage).toHaveBeenCalledWith("MOCK_ACTIVATE");
});

test("reactivateMocking gives up if the worker doesn't answer", async () => {
  stubServiceWorker("silent");
  const { reactivateMocking } = await load();

  expect(await reactivateMocking(20)).toBe(false);
});

test("reactivateMocking resolves false when the page has no worker controller", async () => {
  controller = null;
  const { reactivateMocking } = await load();

  expect(await reactivateMocking()).toBe(false);
});
