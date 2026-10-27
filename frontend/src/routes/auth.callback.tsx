import { createFileRoute } from "@tanstack/react-router";
import AuthCallbackPage from "#/components/auth/AuthCallbackPage";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search.error === "string" ? { error: search.error } : {},
  component: function AuthCallbackRoute() {
    const { error } = Route.useSearch();
    return <AuthCallbackPage error={error} />;
  },
});
