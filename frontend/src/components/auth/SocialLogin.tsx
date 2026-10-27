import { useSocialLogin, useSocialProviders } from "#/auth/api";
import { Button } from "#/components/ui/button";

const PROVIDER_LABELS: Record<string, string> = { google: "Google" };

/** "Continue with …" buttons for the providers the backend has configured; nothing if none. */
export default function SocialLogin() {
  const { data: providers = [] } = useSocialProviders();
  const login = useSocialLogin();
  const known = providers.filter((id) => id in PROVIDER_LABELS);
  if (known.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-center text-xs uppercase text-muted-foreground">or</p>
      {known.map((id) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => login(id)}
        >
          Continue with {PROVIDER_LABELS[id]}
        </Button>
      ))}
    </div>
  );
}
