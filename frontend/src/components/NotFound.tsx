import { Link } from "@tanstack/react-router";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="m-0 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">That page doesn't exist.</p>
      <Link to="/" className="underline underline-offset-4">
        Back to my lists
      </Link>
    </main>
  );
}
