import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthApiError } from "#/api/authFetcher";
import { useResendVerification } from "#/auth/api";
import { Button } from "#/components/ui/button";
import AuthMessage from "./AuthMessage";

/** allauth sends one link per address every 3 minutes (EMAIL_CONFIRMATION_COOLDOWN); asking sooner sends nothing. */
export const RESEND_COOLDOWN_SECONDS = 180;

function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);
  const running = remaining > 0;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setRemaining((left) => Math.max(left - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return [remaining, () => setRemaining(seconds)] as const;
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Shown instead of the form once a confirmation link has been emailed. */
export default function CheckEmail({
  credentials,
  reason,
  onBack,
}: {
  /** What was just typed: allauth only resends the link to a login. Kept in memory, never stored. */
  credentials: { email: string; password: string };
  reason: "signup" | "login";
  /** Already on the login page, where a link to it would do nothing: reset it instead. */
  onBack?: () => void;
}) {
  const { email } = credentials;
  const resend = useResendVerification();
  const [remaining, restart] = useCountdown(RESEND_COOLDOWN_SECONDS);

  return (
    <AuthMessage
      title="Check your email"
      description={
        reason === "signup"
          ? `We sent a link to ${email}. Open it to confirm your address, then log in.`
          : `${email} isn't confirmed yet. We sent you a new link: open it, then log in.`
      }
    >
      <Button
        className="w-full"
        disabled={remaining > 0 || resend.isPending}
        onClick={() => resend.mutate(credentials, { onSuccess: restart })}
      >
        {resend.isPending
          ? "Sending…"
          : remaining > 0
            ? `Resend email in ${clock(remaining)}`
            : "Resend email"}
      </Button>
      {resend.isError && (
        <p role="alert" className="text-sm text-destructive">
          {resend.error instanceof AuthApiError
            ? resend.error.message
            : "Couldn't send the email. Try again later."}
        </p>
      )}
      {resend.isSuccess && remaining > 0 && (
        <output className="text-sm text-muted-foreground">
          Sent again. Check your spam folder too.
        </output>
      )}
      {onBack ? (
        <Button variant="outline" className="w-full" onClick={onBack}>
          Back to log in
        </Button>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          render={<Link to="/login" />}
          nativeButton={false}
        >
          Back to log in
        </Button>
      )}
    </AuthMessage>
  );
}
