import { useState } from "react";
import type { SubmitEvent } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";

interface InlineEditProps {
  value: string;
  label: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

/** Input prefilled with `value`; Enter saves, Escape cancels. Unchanged or blank values just cancel. */
export default function InlineEdit({ value, label, onSave, onCancel }: InlineEditProps) {
  const [draft, setDraft] = useState(value);
  const trimmed = draft.trim();

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!trimmed || trimmed === value) return onCancel();
    onSave(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 gap-2">
      <Input
        autoFocus
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <Button type="submit" disabled={!trimmed}>
        Save
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
