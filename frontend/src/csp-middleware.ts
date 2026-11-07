import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

/**
 * Content-Security-Policy for the pages this server renders. Every request gets a fresh
 * nonce: the router puts it on the inline scripts it streams (see `ssr.nonce` in
 * router.tsx), and `strict-dynamic` lets those scripts load the rest.
 *
 * CSP_MODE (runtime, set in the Kamal config): "report" (default) sends
 * Content-Security-Policy-Report-Only, so violations show in the browser console and
 * nothing is blocked; "enforce" blocks; "off" sends nothing. The other security headers
 * are static: `routeRules` in vite.config.ts. Not in development: Vite injects inline
 * scripts without a nonce.
 */
export const cspMiddleware = createMiddleware().server(({ next }) => {
  const mode = process.env.CSP_MODE ?? "report";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...bytes));

  if (!import.meta.env.DEV && mode !== "off") {
    setResponseHeader(
      mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'`,
        `style-src 'self' 'nonce-${nonce}'`,
        // style="" attributes (React, component libraries) can't carry a nonce
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        // the API is served from the same origin (path prefixes); a separate API host
        // would be added here
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
    );
  }
  return next({ context: { nonce } });
});
