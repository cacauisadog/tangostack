import { Link } from "@tanstack/react-router";
import { useConfirmEmail, useEmailVerification } from "#/auth/api";
import { Button } from "#/components/ui/button";
import AuthLayout from "./AuthLayout";
import AuthMessage from "./AuthMessage";

/** Landing page of the link in the confirmation email: shows the address, confirms on click. */
export default function VerifyEmailPage({ verificationKey }: { verificationKey: string }) {
  const info = useEmailVerification(verificationKey);
  const confirm = useConfirmEmail();

  return (
    <AuthLayout>
      {confirm.isSuccess ? (
        <AuthMessage
          title="Email confirmed"
          description="Your address is confirmed. You can log in now."
        >
          <Button className="w-full" render={<Link to="/login" />} nativeButton={false}>
            Log in
          </Button>
        </AuthMessage>
      ) : info.isError ? (
        <AuthMessage
          error
          title="Link not valid"
          description="This confirmation link is invalid or has expired. Log in to get a new one."
        >
          <Button className="w-full" render={<Link to="/login" />} nativeButton={false}>
            Back to log in
          </Button>
        </AuthMessage>
      ) : info.isPending ? (
        <p className="text-center text-muted-foreground">Checking your link…</p>
      ) : (
        <AuthMessage
          title="Confirm your email"
          description={`Confirm ${info.data.email} to finish setting up your account.`}
        >
          {confirm.isError && (
            <p role="alert" className="text-sm text-destructive">
              {confirm.error.message}
            </p>
          )}
          <Button
            className="w-full"
            disabled={confirm.isPending}
            onClick={() => confirm.mutate(verificationKey)}
          >
            {confirm.isPending ? "Confirming…" : "Confirm email"}
          </Button>
        </AuthMessage>
      )}
    </AuthLayout>
  );
}
