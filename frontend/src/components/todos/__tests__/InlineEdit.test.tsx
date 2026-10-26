import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import InlineEdit from "../InlineEdit";

function setup() {
  const onSave = vi.fn<(value: string) => void>();
  const onCancel = vi.fn<() => void>();
  const user = userEvent.setup();
  render(<InlineEdit value="Work" label="Rename list" onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel, user };
}

test("starts focused and prefilled", () => {
  setup();
  expect(screen.getByRole("textbox", { name: "Rename list" })).toHaveValue("Work");
  expect(screen.getByRole("textbox")).toHaveFocus();
});

test("saves the trimmed value on Enter", async () => {
  const { onSave, user } = setup();
  await user.type(screen.getByRole("textbox"), " and play {Enter}");
  expect(onSave).toHaveBeenCalledExactlyOnceWith("Work and play");
});

test("cancels instead of saving when the value is unchanged", async () => {
  const { onSave, onCancel, user } = setup();
  await user.type(screen.getByRole("textbox"), "{Enter}");
  expect(onSave).not.toHaveBeenCalled();
  expect(onCancel).toHaveBeenCalledOnce();
});

test("does not save a blank value", async () => {
  const { onSave, user } = setup();
  await user.clear(screen.getByRole("textbox"));
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  await user.type(screen.getByRole("textbox"), "   {Enter}");
  expect(onSave).not.toHaveBeenCalled();
});

test("cancels on Escape and on the Cancel button", async () => {
  const { onCancel, user } = setup();
  await user.type(screen.getByRole("textbox"), "{Escape}");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalledTimes(2);
});
