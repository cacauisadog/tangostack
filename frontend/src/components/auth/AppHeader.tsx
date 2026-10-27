import { useLogout, useSession } from "#/auth/api";
import { Button } from "#/components/ui/button";

/** Top bar of the signed-in app: name on the left, who's logged in and logout on the right. */
export default function AppHeader() {
  const { data: user } = useSession();
  const logout = useLogout();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-12 max-w-4xl items-center justify-between gap-4 px-4">
        <span className="font-semibold tracking-tight">Tangostack</span>
        <div className="flex items-center gap-3">
          {user && <span className="text-sm text-muted-foreground">{user.email}</span>}
          <Button
            variant="outline"
            size="sm"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
