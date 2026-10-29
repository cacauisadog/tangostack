import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import AuthMessage from "./AuthMessage";

/** Shown instead of the form once a confirmation link has been emailed. */
export default function CheckEmail({
  email,
  reason,
  onBack,
}: {
  email: string;
  reason: "signup" | "login";
  /** Already on the login page, where a link to it would do nothing: reset it instead. */
  onBack?: () => void;
}) {
  return (
    <AuthMessage
      title="Check your email"
      description={
        reason === "signup"
          ? `We sent a link to ${email}. Open it to confirm your address, then log in.`
          : `${email} isn't confirmed yet. We sent you a new link: open it, then log in.`
      }
    >
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
