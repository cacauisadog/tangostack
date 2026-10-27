import { useLogin } from "#/auth/api";
import AuthForm from "./AuthForm";
import AuthGate from "./AuthGate";
import AuthLayout from "./AuthLayout";

export default function LoginPage() {
  const login = useLogin();
  return (
    <AuthGate require="guest">
      <AuthLayout>
        <AuthForm
          mode="login"
          isPending={login.isPending}
          error={login.error}
          onSubmit={(data) => login.mutate({ data })}
        />
      </AuthLayout>
    </AuthGate>
  );
}
