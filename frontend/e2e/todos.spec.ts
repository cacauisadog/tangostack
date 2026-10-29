import type { TodoListResponse, TodoResponse } from "../src/api/generated/model";
import { expect, test, type Api } from "./fixtures";

async function createList(api: Api, name: string) {
  const response = await api.post("/api/lists", { data: { name } });
  expect(response.status()).toBe(201);
  return (await response.json()) as TodoListResponse;
}

async function createTodo(api: Api, listId: string, text: string) {
  const response = await api.post(`/api/lists/${listId}/todos`, { data: { text } });
  expect(response.status()).toBe(201);
  return (await response.json()) as TodoResponse;
}

test("shows the empty state, then a list created through the UI", async ({ page, api }) => {
  await page.goto("/todo");
  await expect(page.getByText(/no lists yet/i)).toBeVisible();

  await page.getByRole("button", { name: /new list/i }).click();
  await page.getByPlaceholder("List name").fill("Work");
  await page.keyboard.press("Enter");

  await expect(page.getByText("0/0 done")).toBeVisible();
  // proves the browser talked to the real API, not a mock
  const lists = (await (await api.get("/api/lists")).json()) as TodoListResponse[];
  expect(lists.map((list) => list.name)).toEqual(["Work"]);
});

test("adds a task, completes it, and keeps the state after a reload", async ({ page, api }) => {
  const list = await createList(api, "Work");
  await page.goto("/todo");

  await page.getByRole("button", { name: /add task/i }).click();
  await page.getByPlaceholder("Task name").fill("send report");
  await page.keyboard.press("Enter");
  // click + web-first assertion: `.check()` verifies the state synchronously
  await page.getByRole("checkbox", { name: "send report" }).click();
  await expect(page.getByRole("checkbox", { name: "send report" })).toBeChecked();
  await expect(page.getByText("1/1 done")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "send report" })).toBeChecked();
  const lists = (await (await api.get("/api/lists")).json()) as TodoListResponse[];
  expect(lists).toMatchObject([{ id: list.id, todos: [{ text: "send report", done: true }] }]);
});

test("renders lists and todos created through the API", async ({ page, api }) => {
  const work = await createList(api, "Work");
  const home = await createList(api, "Home");
  await createTodo(api, work.id, "ship it");
  await createTodo(api, work.id, "celebrate");
  await createTodo(api, home.id, "do laundry");
  await api.patch(`/api/todos/${(await createTodo(api, home.id, "water plants")).id}`, {
    data: { done: true },
  });

  await page.goto("/todo");

  const workCard = page.locator("[data-slot=card]", { hasText: "Work" });
  const homeCard = page.locator("[data-slot=card]", { hasText: "Home" });
  await expect(workCard.getByText("0/2 done")).toBeVisible();
  await expect(homeCard.getByText("1/2 done")).toBeVisible();
  await expect(homeCard.getByRole("checkbox", { name: "water plants" })).toBeChecked();
});

test("renames a list and edits a task, and both survive a reload", async ({ page, api }) => {
  const list = await createList(api, "Work");
  await createTodo(api, list.id, "send report");
  await page.goto("/todo");

  await page.getByRole("button", { name: 'Rename list "Work"' }).click();
  await page.getByRole("textbox", { name: 'Rename list "Work"' }).fill("Office");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: 'Edit task "send report"' }).click();
  await page.getByRole("textbox", { name: 'Edit task "send report"' }).fill("send the report");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Office", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "send the report" })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Office", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "send the report" })).toBeVisible();
  const lists = (await (await api.get("/api/lists")).json()) as TodoListResponse[];
  expect(lists).toMatchObject([{ name: "Office", todos: [{ text: "send the report" }] }]);
});

test("deletes a task, then the list after confirming", async ({ page, api }) => {
  const list = await createList(api, "Work");
  await createTodo(api, list.id, "ship it");
  await createTodo(api, list.id, "celebrate");
  await page.goto("/todo");

  await page.getByRole("button", { name: 'Delete task "ship it"' }).click();
  await expect(page.getByText("ship it")).toHaveCount(0);
  await expect(page.getByText("0/1 done")).toBeVisible();

  await page.getByRole("button", { name: 'Delete list "Work"' }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(/no lists yet/i)).toBeVisible();

  const lists = (await (await api.get("/api/lists")).json()) as TodoListResponse[];
  expect(lists).toEqual([]);
});
