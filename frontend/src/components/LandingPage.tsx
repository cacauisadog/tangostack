import { Link } from "@tanstack/react-router";
import { useSession } from "#/auth/api";
import { Button } from "#/components/ui/button";

interface LandingPageProps {
  renderedAt: string;
  renderedOn: "server" | "browser";
}

const parts = [
  ["Frontend", "TanStack Start, React 19, shadcn/ui, Tailwind"],
  ["Backend", "Django, Django Ninja, django-allauth"],
  ["Data", "PostgreSQL, one typed OpenAPI contract"],
];

/**
 * Public page, server-rendered: the HTML carries all of this. The session is a
 * client query, so the buttons start as Log in / Sign up and switch after hydration.
 */
export default function LandingPage({ renderedAt, renderedOn }: LandingPageProps) {
  const { data: user } = useSession();

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between gap-4 px-4">
          <span className="font-semibold tracking-tight">Tangostack</span>
          <nav className="flex items-center gap-2">
            {user ? (
              <Button size="sm" render={<Link to="/todo" />} nativeButton={false}>
                Open the app
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link to="/login" />}
                  nativeButton={false}
                >
                  Log in
                </Button>
                <Button size="sm" render={<Link to="/signup" />} nativeButton={false}>
                  Sign up
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="m-0 text-4xl font-bold tracking-tight">Start your product here.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Tangostack is a full-stack template: public pages rendered on the server, a signed-in app
          rendered in the browser, and a Django API behind both. This page is the former. The to-do
          app at{" "}
          <Link to="/todo" className="underline underline-offset-4">
            /todo
          </Link>{" "}
          is the latter.
        </p>
        <ul className="mt-10 grid gap-4 p-0 sm:grid-cols-3">
          {parts.map(([name, text]) => (
            <li key={name} className="list-none rounded-lg border p-4">
              <h2 className="m-0 text-base font-semibold">{name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-muted-foreground" data-testid="render-info">
          Rendered on the {renderedOn} at {renderedAt}. Reload to see the server render it again.
        </p>
      </main>
    </>
  );
}
