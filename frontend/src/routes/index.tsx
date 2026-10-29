import { createFileRoute } from "@tanstack/react-router";
import LandingPage from "#/components/LandingPage";

// A public page: rendered on the server, so the HTML already has its content.
export const Route = createFileRoute("/")({
  loader: () => ({
    renderedAt: new Date().toISOString(),
    renderedOn: typeof document === "undefined" ? ("server" as const) : ("browser" as const),
  }),
  component: function Landing() {
    return <LandingPage {...Route.useLoaderData()} />;
  },
});
