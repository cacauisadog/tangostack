import { useState } from "react";
import { isVerificationPending, useSignup } from "#/auth/api";
import AuthForm from "./AuthForm";
import AuthGate from "./AuthGate";
import AuthLayout from "./AuthLayout";
import CheckEmail from "./CheckEmail";

export default function SignupPage() {
  const signup = useSignup();
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  return (
    <AuthGate require="guest">
      <AuthLayout>
        {isVerificationPending(signup.error) ? (
          <CheckEmail credentials={credentials} reason="signup" />
        ) : (
          <AuthForm
            mode="signup"
            isPending={signup.isPending}
            error={signup.error}
            onSubmit={(data) => {
              setCredentials(data);
              signup.mutate({ data });
            }}
          />
        )}
      </AuthLayout>
    </AuthGate>
  );
}
