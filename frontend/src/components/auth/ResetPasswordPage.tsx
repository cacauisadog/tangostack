import { Link } from "@tanstack/react-router";
import type { SubmitEvent } from "react";
import { usePasswordResetInfo, useResetPassword } from "#/auth/api";
import { AuthApiError } from "#/api/authFetcher";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import AuthLayout from "./AuthLayout";
import AuthMessage from "./AuthMessage";

/** Landing page of the link in the reset email: validates the key, then asks for the new password. */
export default function ResetPasswordPage({ resetKey }: { resetKey: string }) {
  const info = usePasswordResetInfo(resetKey);
  const reset = useResetPassword();
  const error = reset.error instanceof AuthApiError ? reset.error : null;
  const fieldErrors = error?.fieldErrors ?? {};
  const fieldError = fieldErrors.password;
  // A bad key surfaces on the `key` param; anything else without a field shows above the button.
  const formError = reset.error && !fieldError && (fieldErrors.key ?? reset.error.message);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    reset.mutate({ key: resetKey, password });
  }

  if (reset.isSuccess) {
    return (
      <AuthLayout>
        <AuthMessage
          title="Password changed"
          description="Your password was updated. Log in with the new one."
        >
          <Button className="w-full" render={<Link to="/login" />} nativeButton={false}>
            Log in
          </Button>
        </AuthMessage>
      </AuthLayout>
    );
  }
  if (info.isPending) {
    return (
      <AuthLayout>
        <p className="text-center text-muted-foreground">Checking your link…</p>
      </AuthLayout>
    );
  }
  if (info.isError) {
    return (
      <AuthLayout>
        <AuthMessage
          error
          title="Link not valid"
          description="This reset link is invalid or has expired. You can ask for a new one."
        >
          <Button
            className="w-full"
            render={<Link to="/auth/forgot-password" />}
            nativeButton={false}
          >
            Send a new link
          </Button>
        </AuthMessage>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>Pick a password for your account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? "password-error" : undefined}
              />
              {fieldError && (
                <p id="password-error" className="text-sm text-destructive">
                  {fieldError}
                </p>
              )}
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </CardContent>
          <CardFooter className="pt-4">
            <Button type="submit" className="w-full" disabled={reset.isPending}>
              {reset.isPending ? "Saving…" : "Change password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
