import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useSession } from "#/auth/api";

interface AuthGateProps {
  /** `user`: only signed-in users. `guest`: only signed-out visitors. */
  require: "user" | "guest";
  children: ReactNode;
}

/** Client-side route guard: waits for the session, then renders or redirects. */
export default function AuthGate({ require, children }: AuthGateProps) {
  const { data: user, isPending, isError } = useSession();

  if (isPending) return <p className="p-10 text-muted-foreground">Loading…</p>;
  if (isError) {
    return (
      <p role="alert" className="p-10 text-destructive">
        Couldn't reach the server. Try again in a moment.
      </p>
    );
  }
  if (require === "user" && !user) return <Navigate to="/login" replace />;
  if (require === "guest" && user) return <Navigate to="/todo" replace />;
  return children;
}
