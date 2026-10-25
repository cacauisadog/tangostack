import type { APIRequestContext } from "@playwright/test";
import type { TodoListResponse, TodoResponse } from "../src/api/generated/model";
import { expect, test } from "./fixtures";

async function createList(request: APIRequestContext, name: string) {
  const response = await request.post("/api/lists", { data: { name } });
  expect(response.status()).toBe(201);
  return (await response.json()) as TodoListResponse;
}

async function createTodo(request: APIRequestContext, listId: string, text: string) {
  const response = await request.post(`/api/lists/${listId}/todos`, { data: { text } });
  expect(response.status()).toBe(201);
  return (await response.json()) as TodoResponse;
}

test("shows the empty state, then a list created through the UI", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByText(/no lists yet/i)).toBeVisible();

  await page.getByRole("button", { name: /new list/i }).click();
  await page.getByPlaceholder("List name").fill("Work");
  await page.keyboard.press("Enter");

  await expect(page.getByText("0/0 done")).toBeVisible();
  // proves the browser talked to the real API, not a mock
  const lists = (await (await request.get("/api/lists")).json()) as TodoListResponse[];
  expect(lists.map((list) => list.name)).toEqual(["Work"]);
});

test("adds a task, completes it, and keeps the state after a reload", async ({ page, request }) => {
  const list = await createList(request, "Work");
  await page.goto("/");

  await page.getByRole("button", { name: /add task/i }).click();
  await page.getByPlaceholder("Task name").fill("send report");
  await page.keyboard.press("Enter");
  // click + web-first assertion: `.check()` verifies the state synchronously
  await page.getByRole("checkbox", { name: "send report" }).click();
  await expect(page.getByRole("checkbox", { name: "send report" })).toBeChecked();
  await expect(page.getByText("1/1 done")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "send report" })).toBeChecked();
  const lists = (await (await request.get("/api/lists")).json()) as TodoListResponse[];
  expect(lists).toMatchObject([{ id: list.id, todos: [{ text: "send report", done: true }] }]);
});

test("renders lists and todos created through the API", async ({ page, request }) => {
  const work = await createList(request, "Work");
  const home = await createList(request, "Home");
  await createTodo(request, work.id, "ship it");
  await createTodo(request, work.id, "celebrate");
  await createTodo(request, home.id, "do laundry");
  await request.patch(`/api/todos/${(await createTodo(request, home.id, "water plants")).id}`, {
    data: { done: true },
  });

  await page.goto("/");

  const workCard = page.locator("[data-slot=card]", { hasText: "Work" });
  const homeCard = page.locator("[data-slot=card]", { hasText: "Home" });
  await expect(workCard.getByText("0/2 done")).toBeVisible();
  await expect(homeCard.getByText("1/2 done")).toBeVisible();
  await expect(homeCard.getByRole("checkbox", { name: "water plants" })).toBeChecked();
});
