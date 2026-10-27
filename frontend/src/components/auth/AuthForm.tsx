import { Link } from "@tanstack/react-router";
import type { SubmitEvent } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AuthApiError } from "#/api/authFetcher";
import type { AuthUser, Credentials } from "#/auth/types";
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

interface AuthFormProps {
  mode: "login" | "signup";
  mutation: UseMutationResult<AuthUser, AuthApiError, Credentials>;
}

const COPY = {
  login: {
    title: "Log in",
    description: "Welcome back. Log in to see your lists.",
    submit: "Log in",
    pending: "Logging in…",
    switchText: "No account yet?",
    switchLabel: "Sign up",
    switchTo: "/signup",
    passwordAutoComplete: "current-password",
  },
  signup: {
    title: "Sign up",
    description: "Create an account to keep your own lists.",
    submit: "Sign up",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLabel: "Log in",
    switchTo: "/login",
    passwordAutoComplete: "new-password",
  },
} as const;

/** Email + password form shared by the login and signup pages. */
export default function AuthForm({ mode, mutation }: AuthFormProps) {
  const copy = COPY[mode];
  const fieldErrors = mutation.error?.fieldErrors ?? {};
  // Anything the form can't pin on a field (409, network, ...) shows above the button.
  const formError =
    mutation.error && Object.keys(fieldErrors).length === 0 && mutation.error.message;

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    mutation.mutate({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={copy.passwordAutoComplete}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
            />
            {fieldErrors.password && (
              <p id="password-error" className="text-sm text-destructive">
                {fieldErrors.password}
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
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? copy.pending : copy.submit}
          </Button>
          <p className="text-sm text-muted-foreground">
            {copy.switchText}{" "}
            <Link to={copy.switchTo} className="text-foreground underline underline-offset-4">
              {copy.switchLabel}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
