import { describe, expect, it } from "vitest";
import { cspHeader, parseCspMode } from "./csp";

describe("cspHeader", () => {
  it("is report-only in report mode, blocking in enforce mode, absent when off", () => {
    expect(cspHeader("n", "report")?.name).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeader("n", "enforce")?.name).toBe("Content-Security-Policy");
    expect(cspHeader("n", "off")).toBeNull();
  });

  it("allows scripts only through the request's nonce", () => {
    const { value } = cspHeader("abc123", "enforce")!;

    expect(value).toContain("script-src 'nonce-abc123' 'strict-dynamic'");
    expect(value).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
  });

  it("keeps the page from being framed and from loading plugins or other bases", () => {
    const { value } = cspHeader("n", "enforce")!;

    expect(value).toContain("frame-ancestors 'none'");
    expect(value).toContain("object-src 'none'");
    expect(value).toContain("base-uri 'self'");
    // the Google sign-in form redirects there
    expect(value).toContain("form-action 'self' https://accounts.google.com");
    expect(value).toContain("default-src 'self'");
  });
});

describe("parseCspMode", () => {
  it("defaults to report and accepts the three modes", () => {
    expect(parseCspMode(undefined)).toBe("report");
    expect(parseCspMode("")).toBe("report");
    for (const mode of ["off", "report", "enforce"] as const) {
      expect(parseCspMode(mode)).toBe(mode);
    }
  });

  it("rejects a typo instead of silently running without enforcement", () => {
    expect(() => parseCspMode("enforced")).toThrow(/CSP_MODE/);
  });
});
