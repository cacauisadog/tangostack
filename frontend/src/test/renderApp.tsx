import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "#/api/queryClient";
import { render } from "@testing-library/react";
import HomePage from "#/components/HomePage";
import AuthCallbackPage from "#/components/auth/AuthCallbackPage";
import ForgotPasswordPage from "#/components/auth/ForgotPasswordPage";
import LoginPage from "#/components/auth/LoginPage";
import ResetPasswordPage from "#/components/auth/ResetPasswordPage";
import SignupPage from "#/components/auth/SignupPage";
import VerifyEmailPage from "#/components/auth/VerifyEmailPage";
import { registerClient } from "./clients";

/**
 * Renders the real pages at their real paths on a memory router (the app's
 * route files add only the document shell). Returns the router so tests can
 * assert on `router.state.location.pathname`.
 */
export function renderApp(initialPath: string) {
  const queryClient = createQueryClient({ retry: false });
  registerClient(queryClient);

  const root = createRootRoute({ component: Outlet });
  const page = (path: string, component: () => React.ReactNode) =>
    createRoute({ getParentRoute: () => root, path, component });
  const callback = createRoute({
    getParentRoute: () => root,
    path: "/auth/callback",
    validateSearch: (search: Record<string, unknown>): { error?: string } =>
      typeof search.error === "string" ? { error: search.error } : {},
    component: function Callback() {
      return <AuthCallbackPage error={callback.useSearch().error} />;
    },
  });
  const verifyEmail = createRoute({
    getParentRoute: () => root,
    path: "/auth/verify-email/$key",
    component: function VerifyEmailRoute() {
      return <VerifyEmailPage verificationKey={verifyEmail.useParams().key} />;
    },
  });
  const resetPassword = createRoute({
    getParentRoute: () => root,
    path: "/auth/reset-password/$key",
    component: function ResetPasswordRoute() {
      return <ResetPasswordPage resetKey={resetPassword.useParams().key} />;
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([
      page("/", HomePage),
      page("/login", LoginPage),
      page("/signup", SignupPage),
      callback,
      page("/auth/forgot-password", ForgotPasswordPage),
      verifyEmail,
      resetPassword,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
