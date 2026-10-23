import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import TodoItem from "../TodoItem";

const todo = { id: "1", text: "write tests", done: false };

test("renders an unchecked todo", () => {
  render(<TodoItem todo={todo} onToggle={vi.fn<() => void>()} />);
  expect(screen.getByRole("checkbox", { name: "write tests" })).not.toBeChecked();
  expect(screen.getByText("write tests")).not.toHaveClass("line-through");
});

test("renders a done todo as checked and struck through", () => {
  render(<TodoItem todo={{ ...todo, done: true }} onToggle={vi.fn<() => void>()} />);
  expect(screen.getByRole("checkbox", { name: "write tests" })).toBeChecked();
  expect(screen.getByText("write tests")).toHaveClass("line-through");
});

test("calls onToggle when the checkbox is clicked", async () => {
  const onToggle = vi.fn<() => void>();
  render(<TodoItem todo={todo} onToggle={onToggle} />);
  await userEvent.click(screen.getByRole("checkbox", { name: "write tests" }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("calls onToggle when the text is clicked", async () => {
  const onToggle = vi.fn<() => void>();
  render(<TodoItem todo={todo} onToggle={onToggle} />);
  await userEvent.click(screen.getByText("write tests"));
  expect(onToggle).toHaveBeenCalledTimes(1);
});
