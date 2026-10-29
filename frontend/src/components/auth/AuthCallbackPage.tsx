import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRefreshSession } from "#/auth/api";
import { Button } from "#/components/ui/button";
import AuthLayout from "./AuthLayout";

/** Landing page after the provider handshake; the backend adds `?error=` when it failed. */
export default function AuthCallbackPage({ error }: { error?: string }) {
  const refreshSession = useRefreshSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (error) return;
    // the session cookie is already set: load it, then let the route guards decide
    void refreshSession().then(() => navigate({ to: "/todo", replace: true }));
  }, [error, navigate, refreshSession]);

  if (!error) return <p className="p-10 text-muted-foreground">Signing you in…</p>;
  return (
    <AuthLayout>
      <p role="alert" className="text-center text-sm text-destructive">
        Couldn't log you in with that account ({error}).
      </p>
      <Button render={<Link to="/login" />} nativeButton={false}>
        Back to log in
      </Button>
    </AuthLayout>
  );
}
