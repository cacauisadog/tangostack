export type CspMode = "off" | "report" | "enforce";

export function parseCspMode(value: string | undefined): CspMode {
  if (value === undefined || value === "") return "report";
  if (value === "off" || value === "report" || value === "enforce") return value;
  throw new Error(`CSP_MODE must be off, report or enforce, got "${value}"`);
}

/**
 * The Content-Security-Policy header for a page, or null when none is sent. `report`
 * uses the report-only header (violations show in the browser console, nothing is
 * blocked). See csp-middleware.ts.
 */
export function cspHeader(nonce: string, mode: CspMode): { name: string; value: string } | null {
  if (mode === "off") return null;
  const value = [
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
    // "Continue with Google" is a form POST to our API that redirects to Google, and form-action
    // also covers the redirect
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
  ].join("; ");
  return {
    name: mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    value,
  };
}
