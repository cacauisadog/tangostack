import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import TodoItem from "../TodoItem";

const todo = { id: "1", text: "write tests", done: false };

function setup(overrides: Partial<typeof todo> = {}) {
  const onToggle = vi.fn<() => void>();
  const onEdit = vi.fn<(text: string) => void>();
  const onDelete = vi.fn<() => void>();
  const user = userEvent.setup();
  render(<TodoItem todo={{ ...todo, ...overrides }} {...{ onToggle, onEdit, onDelete }} />);
  return { onToggle, onEdit, onDelete, user };
}

test("renders an unchecked todo", () => {
  setup();
  expect(screen.getByRole("checkbox", { name: "write tests" })).not.toBeChecked();
  expect(screen.getByText("write tests")).not.toHaveClass("line-through");
});

test("renders a done todo as checked and struck through", () => {
  setup({ done: true });
  expect(screen.getByRole("checkbox", { name: "write tests" })).toBeChecked();
  expect(screen.getByText("write tests")).toHaveClass("line-through");
});

test("calls onToggle when the checkbox is clicked", async () => {
  const { onToggle, user } = setup();
  await user.click(screen.getByRole("checkbox", { name: "write tests" }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("calls onToggle when the text is clicked", async () => {
  const { onToggle, user } = setup();
  await user.click(screen.getByText("write tests"));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("calls onDelete when the delete button is clicked", async () => {
  const { onDelete, onToggle, user } = setup();
  await user.click(screen.getByRole("button", { name: 'Delete task "write tests"' }));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onToggle).not.toHaveBeenCalled();
});

test("edits the text in place and saves it trimmed", async () => {
  const { onEdit, user } = setup();
  await user.click(screen.getByRole("button", { name: 'Edit task "write tests"' }));

  const input = screen.getByRole("textbox", { name: 'Edit task "write tests"' });
  expect(input).toHaveValue("write tests");
  await user.clear(input);
  await user.type(input, "  write more tests {Enter}");

  expect(onEdit).toHaveBeenCalledExactlyOnceWith("write more tests");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("cancelling an edit keeps the todo as it was", async () => {
  const { onEdit, user } = setup();
  await user.click(screen.getByRole("button", { name: 'Edit task "write tests"' }));
  await user.type(screen.getByRole("textbox"), " extra{Escape}");

  expect(onEdit).not.toHaveBeenCalled();
  expect(screen.getByText("write tests")).toBeInTheDocument();
});
