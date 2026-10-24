import { env } from "#/env";

const RELOAD_FLAG = "msw-reloaded";

export function isMockingEnabled() {
  return env.VITE_API_MOCKING ?? import.meta.env.DEV;
}

function hasReloaded() {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === "1";
  } catch {
    return true; // can't remember a reload, so never risk a reload loop
  }
}

function setReloaded(value: boolean) {
  try {
    if (value) sessionStorage.setItem(RELOAD_FLAG, "1");
    else sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // storage unavailable; nothing to do
  }
}

/**
 * Re-registers this page with the mock worker.
 *
 * The browser may terminate an idle service worker (e.g. when a background tab's
 * keepalive timers are throttled). The restarted worker forgets which pages it
 * serves and lets every request through, while `navigator.serviceWorker.controller`
 * still looks healthy. MSW only sends "MOCK_ACTIVATE" from `worker.start()`, so
 * we send it again ourselves. This relies on MSW's worker protocol (msw is pinned
 * to an exact version); re-check it when upgrading msw.
 *
 * Resolves `true` once the worker confirms, `false` if it can't or doesn't answer.
 */
export function reactivateMocking(timeoutMs = 1500): Promise<boolean> {
  const sw = globalThis.navigator?.serviceWorker;
  const controller = sw?.controller;
  if (!sw || !controller) return Promise.resolve(false);

  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      sw.removeEventListener("message", onMessage);
      resolve(ok);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "MOCKING_ENABLED") return;
      event.ports[0]?.postMessage(undefined); // the worker waits for an ack
      finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    sw.addEventListener("message", onMessage);
    controller.postMessage("MOCK_ACTIVATE");
  });
}

/**
 * Starts the MSW browser worker when mocking is on. Mocking defaults to on in
 * dev and off in production builds; set VITE_API_MOCKING=true|false to override.
 *
 * Never throws: if the worker fails to start the app still hydrates, and API
 * calls will fail with a clear error from the fetcher. Resolves to `false`
 * when it triggered a reload, so the caller can skip hydrating.
 */
export async function enableMocking(): Promise<boolean> {
  if (!isMockingEnabled()) return true;

  try {
    const { worker } = await import("./browser");
    await worker.start({ onUnhandledFrame: "bypass" });
  } catch (error) {
    console.error(
      "[MSW] Failed to start the mock worker; API requests will hit the network.",
      error,
    );
    return true;
  }

  // A registered worker doesn't intercept anything for a page it doesn't control
  // (e.g. after a hard refresh or on the very first visit). A normal reload fixes it.
  if (!navigator.serviceWorker.controller) {
    if (hasReloaded()) {
      console.warn(
        "[MSW] The worker is active but isn't controlling this page, so API requests will bypass the mocks. Try a normal reload (not a hard refresh).",
      );
      return true;
    }
    console.warn("[MSW] This page isn't controlled by the worker yet; reloading once.");
    setReloaded(true);
    location.reload();
    return false;
  }

  setReloaded(false);
  return true;
}
