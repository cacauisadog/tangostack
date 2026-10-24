import { env } from "#/env";

/**
 * Starts the MSW browser worker when mocking is on. Mocking defaults to on in
 * dev and off in production builds; set VITE_API_MOCKING=true|false to override.
 */
export async function enableMocking() {
  if (!(env.VITE_API_MOCKING ?? import.meta.env.DEV)) return;

  const { worker } = await import("./browser");
  await worker.start({ onUnhandledFrame: "bypass" });
}
