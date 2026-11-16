import { IconCheck } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

type Props = Readonly<{
  /** Names the draft, or returns why it can't. */
  onName: (name: string) => string | null;
}>;

/** The "Name this feed" box a new draft feed shows until it's named. */
export function NameFeed({ onName }: Props) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMessage(onName(text));
  };

  return (
    <form className="name-feed" onSubmit={submit}>
      <div className="name-feed-row">
        <input
          type="text"
          // The visitor just pressed + to make this feed, so the name box is where they're headed.
          autoFocus
          value={text}
          placeholder="Name this feed"
          aria-label="Feed name"
          onChange={(e) => {
            setText(e.target.value);
            setMessage(null);
          }}
        />
        <button type="submit" className="icon-button" aria-label="Save name" title="Save name">
          <IconCheck size={16} aria-hidden="true" />
        </button>
      </div>
      {message && (
        <p className="name-feed-message" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
