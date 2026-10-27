import type { TodoListResponse } from "../src/api/generated/model";
import { csrfApi, expect, PASSWORD, signUp, test } from "./fixtures";

test("an anonymous visitor is sent to the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("signs up, logs out, and logs back in", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill("carla@email.com");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("carla@email.com")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill("carla@email.com");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("No lists yet")).toBeVisible();
});

test("keeps the session across a reload", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill("carla@email.com");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/");

  await page.reload();

  await expect(page.getByText("carla@email.com")).toBeVisible();
});

test("shows the server's errors on the form", async ({ page }) => {
  await signUp(page.request, "carla@email.com");
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByLabel("Email").fill("carla@email.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/email address and\/or password/i)).toBeVisible();

  await page.goto("/signup");
  await page.getByLabel("Email").fill("carla@email.com");
  await page.getByLabel("Password").fill("12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText(/too short/i)).toBeVisible();
  await expect(page.getByText(/entirely numeric/i)).toBeVisible();
});

test("users only see their own lists", async ({ page, browser }) => {
  await signUp(page.request, "amanda@email.com");
  const amanda = csrfApi(page.request);
  await amanda.post("/api/lists", { data: { name: "Amanda's list" } });

  const bruno = await browser.newContext();
  const brunoPage = await bruno.newPage();
  await signUp(brunoPage.request, "bruno@email.com");

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
