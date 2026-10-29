import { useState } from "react";
import { isVerificationPending, useSignup } from "#/auth/api";
import AuthForm from "./AuthForm";
import AuthGate from "./AuthGate";
import AuthLayout from "./AuthLayout";
import CheckEmail from "./CheckEmail";

export default function SignupPage() {
  const signup = useSignup();
  const [email, setEmail] = useState("");
  return (
    <AuthGate require="guest">
      <AuthLayout>
        {isVerificationPending(signup.error) ? (
          <CheckEmail email={email} reason="signup" />
        ) : (
          <AuthForm
            mode="signup"
            isPending={signup.isPending}
            error={signup.error}
            onSubmit={(data) => {
              setEmail(data.email);
              signup.mutate({ data });
            }}
          />
        )}
      </AuthLayout>
    </AuthGate>
  );
}
