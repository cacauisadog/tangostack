import type { TodoListResponse } from "../src/api/generated/model";
import { csrfApi, emailedLink, expect, PASSWORD, signUp, test, uniqueEmail } from "./fixtures";

test("an anonymous visitor is sent to the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("signs up, confirms the address from the emailed link, then logs in and out", async ({
  page,
}) => {
  const email = uniqueEmail("carla");
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Check your email", { exact: true })).toBeVisible();

  // not signed in until the link is opened
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(await emailedLink(email, "verify-email"));
  await expect(page.getByText(`Confirm ${email}`)).toBeVisible();
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByText("Email confirmed", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("No lists yet")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("keeps the session across a reload", async ({ page }) => {
  const email = uniqueEmail("carla");
  await signUp(page.request, email);
  await page.goto("/");
  await expect(page.getByText(email)).toBeVisible();

  await page.reload();

  await expect(page.getByText(email)).toBeVisible();
});

test("resets a forgotten password from the emailed link", async ({ page }) => {
  const email = uniqueEmail("carla");
  await signUp(page.request, email);
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  // fill only once the new page is there, not the login form that is still unmounting
  await expect(page.getByText("Forgot your password?")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/we sent a link to reset/i)).toBeVisible();

  await page.goto(await emailedLink(email, "reset-password"));
  await page.getByLabel("New password").fill("12345");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText(/too short/i)).toBeVisible();

  await page.getByLabel("New password").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed", { exact: true })).toBeVisible();

  // the old password no longer works, the new one does
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/email address and\/or password/i)).toBeVisible();
  await page.getByLabel("Password").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/");
});

test("an unusable confirmation link says so", async ({ page }) => {
  await page.goto("/auth/verify-email/not-a-real-key");

  await expect(page.getByText("Link not valid", { exact: true })).toBeVisible();
});

test("shows the server's errors on the form", async ({ page }) => {
  const email = uniqueEmail("carla");
  await signUp(page.request, email);
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/email address and\/or password/i)).toBeVisible();

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText(/too short/i)).toBeVisible();
  await expect(page.getByText(/entirely numeric/i)).toBeVisible();
});

test("users only see their own lists", async ({ page, browser }) => {
  await signUp(page.request, uniqueEmail("amanda"));
  const amanda = csrfApi(page.request);
  await amanda.post("/api/lists", { data: { name: "Amanda's list" } });

  const bruno = await browser.newContext();
  const brunoPage = await bruno.newPage();
  await signUp(brunoPage.request, uniqueEmail("bruno"));

  await page.goto("/");
  await expect(page.getByText("Amanda's list")).toBeVisible();
  await brunoPage.goto("/");
  await expect(brunoPage.getByText(/no lists yet/i)).toBeVisible();

  // Bruno can't reach Amanda's list by id either
  const [list] = (await (await amanda.get("/api/lists")).json()) as TodoListResponse[];
  const attempt = await csrfApi(brunoPage.request).delete(`/api/lists/${list.id}`);
  expect(attempt.status()).toBe(404);
  await bruno.close();
});

test("Continue with Google sends the browser to Google, and a failed return explains itself", async ({
  page,
}) => {
  // the e2e backend has fake Google credentials; never reach the real Google
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>Google sign-in</p>" }),
  );
  await page.goto("/login");

  const toGoogle = page.waitForRequest("https://accounts.google.com/**");
  await page.getByRole("button", { name: "Continue with Google" }).click();

  const url = new URL((await toGoogle).url());
  expect(url.searchParams.get("client_id")).toBe("e2e.apps.googleusercontent.com");
  expect(url.searchParams.get("redirect_uri")).toContain("/accounts/google/login/callback/");

  // what allauth does when the handshake fails
  await page.goto("/auth/callback?error=unknown");
  await expect(page.getByRole("alert")).toContainText("Couldn't log you in");
  await page.getByRole("button", { name: "Back to log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
