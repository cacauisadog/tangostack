import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { db } from "#/mocks/db";
import { server } from "#/mocks/server";
import { renderApp } from "#/test/renderApp";

const cardTitle = { selector: "[data-slot=card-title]" };

// `db.reset()` with no lists is the dev seed: two users, nobody signed in.
async function logIn(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(await screen.findByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

test("sends an anonymous visitor to the login page", async () => {
  db.reset();
  const router = renderApp("/");

  expect(await screen.findByText("Log in", cardTitle)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
});

test("sends a signed-in user away from the login page", async () => {
  db.reset([]);
  const router = renderApp("/login");

  expect(await screen.findByText("My lists")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
});

test("logs in, shows only that user's lists, and logs out", async () => {
  db.reset();
  const user = userEvent.setup();
  const router = renderApp("/login");

  await logIn(user, "amanda@email.com", "password");

  expect(await screen.findByText("Work", cardTitle)).toBeInTheDocument();
  expect(screen.getByText("amanda@email.com")).toBeInTheDocument();
  expect(screen.queryByText("Trip to Lisbon", cardTitle)).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");

  await user.click(screen.getByRole("button", { name: "Log out" }));

  expect(await screen.findByText("Log in", cardTitle)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
});

test("a second user sees their own data, never the first user's", async () => {
  db.reset();
  const user = userEvent.setup();
  renderApp("/login");

  await logIn(user, "amanda@email.com", "password");
  await screen.findByText("Work", cardTitle);
  await user.click(screen.getByRole("button", { name: "Log out" }));
  await logIn(user, "bruno@email.com", "password");

  expect(await screen.findByText("Trip to Lisbon", cardTitle)).toBeInTheDocument();
  expect(screen.getByText("bruno@email.com")).toBeInTheDocument();
  expect(screen.queryByText("Work", cardTitle)).not.toBeInTheDocument();
});

test("shows an inline error for wrong credentials and stays on the page", async () => {
  db.reset();
  const user = userEvent.setup();
  const router = renderApp("/login");

  await logIn(user, "amanda@email.com", "wrong-password");

  expect(await screen.findByText(/email address and\/or password/i)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
});

test("signing up asks to check the inbox; the emailed link confirms the address, then login works", async () => {
  db.reset();
  const user = userEvent.setup();
  const router = renderApp("/signup");

  await user.type(await screen.findByLabelText("Email"), "carla@example.com");
  await user.type(screen.getByLabelText("Password"), "a-long-password");
  await user.click(screen.getByRole("button", { name: "Sign up" }));

  expect(await screen.findByText("Check your email", cardTitle)).toBeInTheDocument();
  expect(screen.getByText(/carla@example.com/)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/signup");

  // not confirmed yet: the login asks for the link again instead of signing in
  await router.navigate({ to: "/login" });
  await logIn(user, "carla@example.com", "a-long-password");
  expect(await screen.findByText(/isn't confirmed yet/i)).toBeInTheDocument();

  // already on /login, so "Back to log in" has to bring the form back itself
  await user.click(screen.getByRole("button", { name: "Back to log in" }));
  expect(await screen.findByText("Log in", cardTitle)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");

  // the link in the email (mock keys are predictable)
  await router.navigate({
    to: "/auth/verify-email/$key",
    params: { key: "verify-carla@example.com" },
  });
  expect(await screen.findByText(/Confirm carla@example.com/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Confirm email" }));
  expect(await screen.findByText("Email confirmed", cardTitle)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Log in" }));
  await logIn(user, "carla@example.com", "a-long-password");
  expect(await screen.findByText(/no lists yet/i)).toBeInTheDocument();
  expect(screen.getByText("carla@example.com")).toBeInTheDocument();
});

test("signing up with a taken email looks the same as with a new one", async () => {
  db.reset();
  const user = userEvent.setup();
  renderApp("/signup");

  await user.type(await screen.findByLabelText("Email"), "amanda@email.com");
  await user.type(screen.getByLabelText("Password"), "a-long-password");
  await user.click(screen.getByRole("button", { name: "Sign up" }));

  expect(await screen.findByText("Check your email", cardTitle)).toBeInTheDocument();
});

test("an invalid or expired confirmation link says so", async () => {
  db.reset();
  renderApp("/auth/verify-email/not-a-real-key");

  expect(await screen.findByText("Link not valid", cardTitle)).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/invalid or has expired/i);
});

test("resets a forgotten password from the emailed link", async () => {
  db.reset();
  const user = userEvent.setup();
  const router = renderApp("/login");

  await user.click(await screen.findByRole("link", { name: "Forgot password?" }));
  await user.type(await screen.findByLabelText("Email"), "amanda@email.com");
  await user.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByText(/we sent a link to reset/i)).toBeInTheDocument();

  await router.navigate({
    to: "/auth/reset-password/$key",
    params: { key: "reset-amanda@email.com" },
  });
  await user.type(await screen.findByLabelText("New password"), "12345");
  await user.click(screen.getByRole("button", { name: "Change password" }));
  expect(await screen.findByText(/too short/i)).toBeInTheDocument();

  await user.clear(screen.getByLabelText("New password"));
  await user.type(screen.getByLabelText("New password"), "another-long-password");
  await user.click(screen.getByRole("button", { name: "Change password" }));
  expect(await screen.findByText("Password changed", cardTitle)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Log in" }));
  await logIn(user, "amanda@email.com", "another-long-password");
  expect(await screen.findByText("Work", cardTitle)).toBeInTheDocument();
});

test("an invalid reset link offers a new one", async () => {
  db.reset();
  renderApp("/auth/reset-password/nope");

  expect(await screen.findByText("Link not valid", cardTitle)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send a new link" })).toBeInTheDocument();
});

test("shows Django's password validation messages on the password field", async () => {
  db.reset();
  const user = userEvent.setup();
  renderApp("/signup");

  await user.type(await screen.findByLabelText("Email"), "carla@example.com");
  await user.type(screen.getByLabelText("Password"), "12345");
  await user.click(screen.getByRole("button", { name: "Sign up" }));

  expect(await screen.findByText(/too short/i)).toBeInTheDocument();
  expect(screen.getByText(/entirely numeric/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInvalid();
});

test("shows an alert when the session request itself fails", async () => {
  server.use(
    http.get("*/_allauth/browser/v1/auth/session", () =>
      HttpResponse.json({ status: 500 }, { status: 500 }),
    ),
  );
  renderApp("/");

  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the server/i);
});

test("sends a signed-in user to the login page when the API says the session expired", async () => {
  db.reset([]);
  const router = renderApp("/");
  await screen.findByText("My lists");

  server.use(
    http.get("*/api/lists", () => HttpResponse.json({ detail: "Unauthorized" }, { status: 401 })),
  );
  await userEvent.setup().click(screen.getByRole("button", { name: /new list/i }));
  await userEvent.setup().type(screen.getByPlaceholderText("List name"), "Work{Enter}");

  expect(await screen.findByText("Log in", cardTitle)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
});

test("offers Google on login and signup, and signing in lands on the user's lists", async () => {
  db.reset();
  const user = userEvent.setup();
  const router = renderApp("/signup");

  await user.click(await screen.findByRole("button", { name: "Continue with Google" }));

  expect(await screen.findByText("My lists")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
  expect(screen.getByText("vanilda@gmail.com")).toBeInTheDocument();
  // a brand-new account: none of the other users' lists
  expect(screen.queryByText("Work", cardTitle)).not.toBeInTheDocument();
});

test("hides the social buttons when the backend offers no provider", async () => {
  db.reset();
  server.use(
    http.get("*/_allauth/browser/v1/auth/session", () =>
      HttpResponse.json(
        {
          status: 401,
          data: { flows: [{ id: "login" }, { id: "signup" }] },
          meta: { is_authenticated: false },
        },
        { status: 401 },
      ),
    ),
  );
  renderApp("/login");

  await screen.findByText("Log in", cardTitle);
  expect(screen.queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();
});

test("a failed provider handshake explains it and links back to login", async () => {
  db.reset();
  const user = userEvent.setup();
  const router = renderApp("/auth/callback?error=unknown");

  expect(await screen.findByRole("alert")).toHaveTextContent("(unknown)");
  await user.click(screen.getByRole("button", { name: "Back to log in" }));

  expect(router.state.location.pathname).toBe("/login");
});

test("returning from the provider loads the new session", async () => {
  // the backend already set the session cookie before redirecting here
  db.reset([]);
  const router = renderApp("/auth/callback");

  expect(await screen.findByText("My lists")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
});
