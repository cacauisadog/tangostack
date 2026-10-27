import { useSignup } from "#/auth/api";
import AuthForm from "./AuthForm";
import AuthGate from "./AuthGate";
import AuthLayout from "./AuthLayout";

export default function SignupPage() {
  const signup = useSignup();
  return (
    <AuthGate require="guest">
      <AuthLayout>
        <AuthForm mode="signup" mutation={signup} />
      </AuthLayout>
    </AuthGate>
  );
}
