import { createFileRoute } from "@tanstack/react-router";
import VerifyEmailPage from "#/components/auth/VerifyEmailPage";

export const Route = createFileRoute("/auth/verify-email/$key")({
  component: function VerifyEmailRoute() {
    const { key } = Route.useParams();
    return <VerifyEmailPage verificationKey={key} />;
  },
});
