import { useState } from "react";
import { isVerificationPending, useLogin } from "#/auth/api";
import AuthForm from "./AuthForm";
import AuthGate from "./AuthGate";
import AuthLayout from "./AuthLayout";
import CheckEmail from "./CheckEmail";

export default function LoginPage() {
  const login = useLogin();
  const [email, setEmail] = useState("");
  return (
    <AuthGate require="guest">
      <AuthLayout>
        {isVerificationPending(login.error) ? (
          <CheckEmail email={email} reason="login" />
        ) : (
          <AuthForm
            mode="login"
            isPending={login.isPending}
            error={login.error}
            onSubmit={(data) => {
              setEmail(data.email);
              login.mutate({ data });
            }}
          />
        )}
      </AuthLayout>
    </AuthGate>
  );
}
