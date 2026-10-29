import { Link } from "@tanstack/react-router";
import type { SubmitEvent } from "react";
import { useForgotPassword } from "#/auth/api";
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

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const fieldError = forgot.error?.fieldErrors.email;
  const formError = forgot.error && !fieldError && forgot.error.message;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    forgot.mutate({ data: { email } });
  }

  if (forgot.isSuccess) {
    return (
      <AuthLayout>
        <AuthMessage
          title="Check your email"
          description={`If there is an account for ${forgot.variables.data.email}, we sent a link to reset its password.`}
        >
          <Button
            variant="outline"
            className="w-full"
            render={<Link to="/login" />}
            nativeButton={false}
          >
            Back to log in
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
            <CardTitle>Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a link to reset it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? "email-error" : undefined}
              />
              {fieldError && (
                <p id="email-error" className="text-sm text-destructive">
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
          <CardFooter className="flex flex-col gap-3 pt-4">
            <Button type="submit" className="w-full" disabled={forgot.isPending}>
              {forgot.isPending ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-sm text-muted-foreground">
              <Link to="/login" className="text-foreground underline underline-offset-4">
                Back to log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
}
