import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import TodoApp from "../TodoApp";

function setup() {
  const user = userEvent.setup();
  render(<TodoApp />);

  async function createList(name: string) {
    // the input stays open after a submit, so only click the trigger when it's closed
    const trigger = screen.queryByRole("button", { name: /new list/i });
    if (trigger) await user.click(trigger);
    await user.type(screen.getByPlaceholderText("List name"), `${name}{Enter}`);
  }

  function getCard(name: string) {
    return screen
      .getByText(name, { selector: "[data-slot=card-title]" })
      .closest("[data-slot=card]") as HTMLElement;
  }

  async function addTask(listName: string, text: string) {
    const card = within(getCard(listName));
    // the input stays open after a submit, so only click the trigger when it's closed
    const trigger = card.queryByRole("button", { name: /add task/i });
    if (trigger) await user.click(trigger);
    await user.type(card.getByPlaceholderText("Task name"), `${text}{Enter}`);
  }

  return { user, createList, getCard, addTask };
}

test("starts with an empty state", () => {
  setup();
  expect(screen.getByText(/no lists yet/i)).toBeInTheDocument();
});

test("creates a list", async () => {
  const { createList } = setup();
  await createList("Work");

  expect(screen.getByText("Work", { selector: "[data-slot=card-title]" })).toBeInTheDocument();
  expect(screen.queryByText(/no lists yet/i)).not.toBeInTheDocument();
  expect(screen.getByText("0/0 done")).toBeInTheDocument();
});

test("adds tasks to the right list", async () => {
  const { createList, addTask, getCard } = setup();
  await createList("Work");
  await createList("Home");
  await addTask("Work", "send report");
  await addTask("Home", "do laundry");

  expect(within(getCard("Work")).getByText("send report")).toBeInTheDocument();
  expect(within(getCard("Work")).queryByText("do laundry")).not.toBeInTheDocument();
  expect(within(getCard("Home")).getByText("do laundry")).toBeInTheDocument();
});

test("adds several tasks in a row", async () => {
  const { createList, addTask, getCard } = setup();
  await createList("Work");
  await addTask("Work", "one");
  await addTask("Work", "two");

  expect(within(getCard("Work")).getAllByRole("checkbox")).toHaveLength(2);
});

test("marks a task done and undoes it, updating the counter", async () => {
  const { user, createList, addTask, getCard } = setup();
  await createList("Work");
  await addTask("Work", "send report");
  const card = within(getCard("Work"));
  const checkbox = card.getByRole("checkbox", { name: "send report" });

  expect(card.getByText("0/1 done")).toBeInTheDocument();

  await user.click(checkbox);
  expect(checkbox).toBeChecked();
  expect(card.getByText("send report")).toHaveClass("line-through");
  expect(card.getByText("1/1 done")).toBeInTheDocument();

  await user.click(card.getByText("send report"));
  expect(checkbox).not.toBeChecked();
  expect(card.getByText("0/1 done")).toBeInTheDocument();
});

test("toggling a task does not affect other lists or tasks", async () => {
  const { user, createList, addTask, getCard } = setup();
  await createList("Work");
  await createList("Home");
  await addTask("Work", "same name");
  await addTask("Work", "other");
  await addTask("Home", "same name");

  await user.click(within(getCard("Work")).getByRole("checkbox", { name: "same name" }));

  expect(within(getCard("Work")).getByRole("checkbox", { name: "same name" })).toBeChecked();
  expect(within(getCard("Work")).getByRole("checkbox", { name: "other" })).not.toBeChecked();
  expect(within(getCard("Home")).getByRole("checkbox", { name: "same name" })).not.toBeChecked();
});
