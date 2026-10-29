import { expect, test } from "./fixtures";

test("the landing page arrives server-rendered, with no JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Start your product here." })).toBeVisible();
  await expect(page.getByTestId("render-info")).toContainText("Rendered on the server");
  await context.close();
});

test("signed-in users get the app from the landing page", async ({ page, api }) => {
  void api;
  await page.goto("/");
  await page.getByRole("button", { name: "Open the app" }).click();
  await expect(page).toHaveURL("/todo");
});
