import { createFileRoute } from "@tanstack/react-router";

/** Liveness probe for the hosting platform: the Node server is up. */
export const Route = createFileRoute("/healthz")({
  server: { handlers: { GET: () => Response.json({ status: "ok" }) } },
});
