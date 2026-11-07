import { createStart } from "@tanstack/react-start";
import { cspMiddleware } from "./csp-middleware";

export const startInstance = createStart(() => ({
  requestMiddleware: [cspMiddleware],
}));

// Types the global request context (the CSP nonce) for `getGlobalStartContext()`.
declare module "@tanstack/react-start" {
  interface Register {
    config: Awaited<ReturnType<typeof startInstance.getOptions>>;
  }
}
