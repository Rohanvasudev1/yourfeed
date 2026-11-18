import { IconCheck, IconSend } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

const USERNAME = /^[a-z0-9_.]{3,20}$/i;

/** Why a username can't be sent to, or null when it can. */
function usernameProblem(name: string, sent: readonly string[]): string | null {
  if (!name) return "Type a username first";
  if (!USERNAME.test(name)) return "Usernames are 3–20 letters, numbers, dots or underscores";
  if (sent.some((s) => s.toLowerCase() === name.toLowerCase())) return `Already sent to @${name}`;
  return null;
}

/** "Send to someone on Yourfeed": checks the username and lists who it went to. Demo only: nothing leaves the browser. */
export function ShareSend({ disabled }: Readonly<{ disabled: boolean }>) {
  const [name, setName] = useState("");
  const [sent, setSent] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const send = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    const username = name.trim().replace(/^@/, "");
    const problem = usernameProblem(username, sent);
    setError(problem);
    if (problem) return;
    setSent([...sent, username]);
    setName("");
  };

  return (
    <form className="share-send" onSubmit={send}>
      <p className="share-label">Send to someone on Yourfeed</p>
      <div className="share-row">
        <input
          type="text"
          aria-label="Username to send this feed to"
          placeholder="@username"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className="primary text-button" disabled={disabled}>
          <IconSend size={15} aria-hidden="true" />
          Send
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {sent.length > 0 && (
        <p className="share-sent">
          <IconCheck size={14} aria-hidden="true" />
          Sent to {sent.map((n) => `@${n}`).join(", ")}
        </p>
      )}
    </form>
  );
}
