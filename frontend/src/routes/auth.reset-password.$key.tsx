import { createFileRoute } from "@tanstack/react-router";
import ResetPasswordPage from "#/components/auth/ResetPasswordPage";

export const Route = createFileRoute("/auth/reset-password/$key")({
  component: function ResetPasswordRoute() {
    const { key } = Route.useParams();
    return <ResetPasswordPage resetKey={key} />;
  },
});
