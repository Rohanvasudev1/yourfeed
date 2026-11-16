import { IconCheck } from "@tabler/icons-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

type Props = Readonly<{
  /** Makes the folder; returns why it couldn't, or null when it did. */
  onCreate: (name: string) => string | null;
  onCancel: () => void;
}>;

/** A folder name box with a Create button. Enter creates, Escape cancels. */
export function NewFolderForm({ onCreate, onCancel }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(onCreate(name));
  };
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onCancel();
  };

  return (
    <form className="new-folder" onSubmit={submit}>
      <div className="new-folder-row">
        <input
          type="text"
          aria-label="Folder name"
          placeholder="Folder name"
          value={name}
          // The form only appears after the visitor asked for it, so typing can start at once.
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={cancelOnEscape}
        />
        <button type="submit" className="icon-button" aria-label="Create folder" title="Create folder">
          <IconCheck size={16} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
