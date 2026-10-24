import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { db } from "#/mocks/db";
import { server } from "#/mocks/server";
import { renderWithClient } from "#/test/render";
import TodoApp from "../TodoApp";

const cardTitle = { selector: "[data-slot=card-title]" };

async function setup() {
  const user = userEvent.setup();
  renderWithClient(<TodoApp />);
  // wait for the initial fetch to finish
  await waitFor(() => expect(screen.queryByText(/loading lists/i)).not.toBeInTheDocument());

  async function createList(name: string) {
    // the input stays open after a submit, so only click the trigger when it's closed
    const trigger = screen.queryByRole("button", { name: /new list/i });
    if (trigger) await user.click(trigger);
    await user.type(screen.getByPlaceholderText("List name"), `${name}{Enter}`);
    await screen.findByText(name, cardTitle);
  }

  function getCard(name: string) {
    return screen.getByText(name, cardTitle).closest("[data-slot=card]") as HTMLElement;
  }

  async function addTask(listName: string, text: string) {
    const card = within(getCard(listName));
    // the input stays open after a submit, so only click the trigger when it's closed
    const trigger = card.queryByRole("button", { name: /add task/i });
    if (trigger) await user.click(trigger);
    await user.type(card.getByPlaceholderText("Task name"), `${text}{Enter}`);
    await card.findByText(text);
  }

  return { user, createList, getCard, addTask };
}

test("shows a loading state, then the empty state", async () => {
  renderWithClient(<TodoApp />);
  expect(screen.getByText(/loading lists/i)).toBeInTheDocument();
  expect(await screen.findByText(/no lists yet/i)).toBeInTheDocument();
});

test("renders lists and todos from the API", async () => {
  db.reset([
    {
      id: "l1",
      name: "Work",
      todos: [
        { id: "t1", text: "ship it", done: true },
        { id: "t2", text: "celebrate", done: false },
      ],
    },
  ]);
  await setup();

  const card = within(
    screen.getByText("Work", cardTitle).closest("[data-slot=card]") as HTMLElement,
  );
  expect(card.getByRole("checkbox", { name: "ship it" })).toBeChecked();
  expect(card.getByRole("checkbox", { name: "celebrate" })).not.toBeChecked();
  expect(card.getByText("1/2 done")).toBeInTheDocument();
});

test("shows an error state when the lists request fails", async () => {
  server.use(
    http.get("*/api/lists", () => HttpResponse.json({ message: "boom" }, { status: 500 })),
  );
  renderWithClient(<TodoApp />);

  expect(await screen.findByText(/couldn't load your lists/i)).toBeInTheDocument();
});

test("creates a list", async () => {
  const { createList } = await setup();
  expect(screen.getByText(/no lists yet/i)).toBeInTheDocument();

  await createList("Work");

  expect(screen.getByText("Work", cardTitle)).toBeInTheDocument();
  expect(screen.queryByText(/no lists yet/i)).not.toBeInTheDocument();
  expect(screen.getByText("0/0 done")).toBeInTheDocument();
});

test("persists created data across refetches", async () => {
  const { createList, addTask } = await setup();
  await createList("Work");
  await addTask("Work", "send report");

  expect(db.getLists()).toMatchObject([
    { name: "Work", todos: [{ text: "send report", done: false }] },
  ]);
});

test("adds tasks to the right list", async () => {
  const { createList, addTask, getCard } = await setup();
  await createList("Work");
  await createList("Home");
  await addTask("Work", "send report");
  await addTask("Home", "do laundry");

  expect(within(getCard("Work")).getByText("send report")).toBeInTheDocument();
  expect(within(getCard("Work")).queryByText("do laundry")).not.toBeInTheDocument();
  expect(within(getCard("Home")).getByText("do laundry")).toBeInTheDocument();
});

test("adds several tasks in a row", async () => {
  const { createList, addTask, getCard } = await setup();
  await createList("Work");
  await addTask("Work", "one");
  await addTask("Work", "two");

  expect(within(getCard("Work")).getAllByRole("checkbox")).toHaveLength(2);
});

test("marks a task done and undoes it, updating the counter", async () => {
  const { user, createList, addTask, getCard } = await setup();
  await createList("Work");
  await addTask("Work", "send report");
  const card = within(getCard("Work"));
  const checkbox = card.getByRole("checkbox", { name: "send report" });

  expect(card.getByText("0/1 done")).toBeInTheDocument();

  await user.click(checkbox);
  await waitFor(() => expect(checkbox).toBeChecked());
  expect(card.getByText("send report")).toHaveClass("line-through");
  expect(card.getByText("1/1 done")).toBeInTheDocument();
  await waitFor(() => expect(db.getLists()[0].todos[0].done).toBe(true));

  await user.click(card.getByText("send report"));
  await waitFor(() => expect(checkbox).not.toBeChecked());
  expect(card.getByText("0/1 done")).toBeInTheDocument();
});

test("toggling a task does not affect other lists or tasks", async () => {
  const { user, createList, addTask, getCard } = await setup();
  await createList("Work");
  await createList("Home");
  await addTask("Work", "same name");
  await addTask("Work", "other");
  await addTask("Home", "same name");

  await user.click(within(getCard("Work")).getByRole("checkbox", { name: "same name" }));

  await waitFor(() =>
    expect(within(getCard("Work")).getByRole("checkbox", { name: "same name" })).toBeChecked(),
  );
  expect(within(getCard("Work")).getByRole("checkbox", { name: "other" })).not.toBeChecked();
  expect(within(getCard("Home")).getByRole("checkbox", { name: "same name" })).not.toBeChecked();
});

test("rolls back an optimistic toggle when the request fails", async () => {
  db.reset([{ id: "l1", name: "Work", todos: [{ id: "t1", text: "ship it", done: false }] }]);
  const { user } = await setup();
  server.use(
    http.patch("*/api/todos/:todoId", () =>
      HttpResponse.json({ message: "nope" }, { status: 500 }),
    ),
  );

  await user.click(screen.getByRole("checkbox", { name: "ship it" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("nope");
  expect(screen.getByRole("checkbox", { name: "ship it" })).not.toBeChecked();
});

test("shows an error when creating a list fails", async () => {
  const { user } = await setup();
  server.use(
    http.post("*/api/lists", () =>
      HttpResponse.json({ message: "name is taken" }, { status: 422 }),
    ),
  );

  await user.click(screen.getByRole("button", { name: /new list/i }));
  await user.type(screen.getByPlaceholderText("List name"), "Work{Enter}");

  expect(await screen.findByRole("alert")).toHaveTextContent("name is taken");
  expect(screen.queryByText("Work", cardTitle)).not.toBeInTheDocument();
});
