import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";

interface InlineFormProps {
  triggerLabel: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
}

/** Button that expands into an input; Enter submits, Escape cancels. */
export default function InlineForm({
  triggerLabel,
  placeholder,
  submitLabel,
  onSubmit,
}: InlineFormProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  function close() {
    setOpen(false);
    setValue("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        + {triggerLabel}
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && close()}
      />
      <Button type="submit" disabled={!value.trim()}>
        {submitLabel}
      </Button>
      <Button type="button" variant="ghost" onClick={close}>
        Cancel
      </Button>
    </form>
  );
}
