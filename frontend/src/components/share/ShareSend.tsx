import { IconCheck, IconSend } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { cleanUsername, usernameProblem } from "../../domain/username";

/** "Send to someone on Yourfeed": checks the username and lists who it went to. Demo only: nothing leaves the browser. */
export function ShareSend({ disabled, quickSend }: Readonly<{ disabled: boolean; quickSend: readonly string[] }>) {
  const [name, setName] = useState("");
  const [sent, setSent] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sendTo = (typed: string) => {
    if (disabled) return;
    const username = cleanUsername(typed);
    const problem = usernameProblem(username, sent);
    setError(problem);
    if (problem) return;
    setSent([...sent, username]);
    setName("");
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    sendTo(name);
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
      {quickSend.length > 0 && (
        <div className="share-quick">
          {quickSend.map((n) => (
            <button key={n} type="button" className="share-chip" aria-label={`Send to @${n}`} disabled={disabled} onClick={() => sendTo(n)}>
              @{n}
            </button>
          ))}
        </div>
      )}
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
