import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { cspHeader, parseCspMode } from "./lib/csp";

/**
 * Content-Security-Policy for the pages this server renders (the policy: lib/csp.ts).
 * Every request gets a fresh nonce: the router puts it on the inline scripts it streams
 * (see `ssr.nonce` in router.tsx), and `strict-dynamic` lets those scripts load the rest.
 *
 * CSP_MODE (runtime, set in the Kamal config): "report" (default), "enforce" or "off".
 * The other security headers are static: `routeRules` in vite.config.ts. No CSP in
 * development: Vite injects inline scripts without a nonce.
 */
export const cspMiddleware = createMiddleware().server(({ next }) => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...bytes));

  const header = import.meta.env.DEV ? null : cspHeader(nonce, parseCspMode(process.env.CSP_MODE));
  if (header) setResponseHeader(header.name, header.value);
  return next({ context: { nonce } });
});
