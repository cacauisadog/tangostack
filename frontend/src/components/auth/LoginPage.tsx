import { useState } from "react";
import { isVerificationPending, useLogin } from "#/auth/api";
import AuthForm from "./AuthForm";
import AuthGate from "./AuthGate";
import AuthLayout from "./AuthLayout";
import CheckEmail from "./CheckEmail";

export default function LoginPage() {
  const login = useLogin();
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  return (
    <AuthGate require="guest">
      <AuthLayout>
        {isVerificationPending(login.error) ? (
          <CheckEmail credentials={credentials} reason="login" onBack={login.reset} />
        ) : (
          <AuthForm
            mode="login"
            isPending={login.isPending}
            error={login.error}
            onSubmit={(data) => {
              setCredentials(data);
              login.mutate({ data });
            }}
          />
        )}
      </AuthLayout>
    </AuthGate>
  );
}
