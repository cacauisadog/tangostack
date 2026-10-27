import type { ReactNode } from "react";

/** Centered shell for the login and signup pages. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <p className="text-center text-2xl font-bold tracking-tight">Tangostack</p>
      {children}
    </main>
  );
}
