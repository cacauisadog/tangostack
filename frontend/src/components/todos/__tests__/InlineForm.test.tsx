import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import InlineForm from "../InlineForm";

function setup() {
  const onSubmit = vi.fn<(value: string) => void>();
  const user = userEvent.setup();
  render(
    <InlineForm
      triggerLabel="Add task"
      placeholder="Task name"
      submitLabel="Add"
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, user };
}

test("shows only the trigger button at first", () => {
  setup();
  expect(screen.getByRole("button", { name: /add task/i })).toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Task name")).not.toBeInTheDocument();
});

test("opens a focused input when the trigger is clicked", async () => {
  const { user } = setup();
  await user.click(screen.getByRole("button", { name: /add task/i }));
  expect(screen.getByPlaceholderText("Task name")).toHaveFocus();
});

test("submits the trimmed value on Enter and keeps the form open and empty", async () => {
  const { user, onSubmit } = setup();
  await user.click(screen.getByRole("button", { name: /add task/i }));
  await user.type(screen.getByPlaceholderText("Task name"), "  buy milk  {Enter}");

  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("buy milk");
  expect(screen.getByPlaceholderText("Task name")).toHaveValue("");
});

test("submits via the submit button", async () => {
  const { user, onSubmit } = setup();
  await user.click(screen.getByRole("button", { name: /add task/i }));
  await user.type(screen.getByPlaceholderText("Task name"), "call mom");
  await user.click(screen.getByRole("button", { name: "Add" }));

  expect(onSubmit).toHaveBeenCalledExactlyOnceWith("call mom");
});

test("does not submit blank input", async () => {
  const { user, onSubmit } = setup();
  await user.click(screen.getByRole("button", { name: /add task/i }));

  expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  await user.type(screen.getByPlaceholderText("Task name"), "   {Enter}");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("Escape closes the form and discards the draft", async () => {
  const { user, onSubmit } = setup();
  await user.click(screen.getByRole("button", { name: /add task/i }));
  await user.type(screen.getByPlaceholderText("Task name"), "draft{Escape}");

  expect(screen.queryByPlaceholderText("Task name")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /add task/i }));
  expect(screen.getByPlaceholderText("Task name")).toHaveValue("");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("Cancel closes the form", async () => {
  const { user } = setup();
  await user.click(screen.getByRole("button", { name: /add task/i }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByPlaceholderText("Task name")).not.toBeInTheDocument();
});
