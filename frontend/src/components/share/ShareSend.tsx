import { IconCheck, IconSend } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { SEND_TEXT } from "../../domain/sending";
import { cleanUsername, usernameProblem } from "../../domain/username";



/** Sends to a username for real: resolves to the username as the server keeps it, or to why it wasn't sent. */
export type SendTo = (username: string) => Promise<Readonly<{ ok: true; to: string }> | Readonly<{ ok: false; problem: string }>>;

type Props = Readonly<{
  disabled: boolean;
  quickSend: readonly string[];
  /** Signed in, sends for real (ADR 0013); null in demo mode, where nothing leaves the browser. */
  sendTo: SendTo | null;
}>;

/** "Send to someone on Yourfeed": checks the username, sends, and lists who it went to. */
export function ShareSend({ disabled, quickSend, sendTo }: Props) {
  const [name, setName] = useState("");
  const [sent, setSent] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const delivered = (username: string) => {
    setSent((before) => [...before, username]);
    setName("");
  };

  const send = async (typed: string) => {
    if (disabled || sending) return;
    const username = cleanUsername(typed);
    const problem = usernameProblem(username, sent);
    setError(problem);
    if (problem) return;
    if (!sendTo) return delivered(username);
    setSending(true);
    const answer = await sendTo(username).catch((err: unknown) => {
      console.error("Couldn't send a share", err);
      return { ok: false, problem: SEND_TEXT.failed } as const;
    });
    setSending(false);
    if (answer.ok) delivered(answer.to);
    else setError(answer.problem);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(name);
  };

  return (
    <form className="share-send" onSubmit={submit} aria-busy={sending}>
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
        <button type="submit" className="primary text-button" disabled={disabled || sending}>
          <IconSend size={15} aria-hidden="true" />
          Send
        </button>
      </div>
      {quickSend.length > 0 && (
        <div className="share-quick">
          {quickSend.map((n) => (
            <button key={n} type="button" className="share-chip" aria-label={`Send to @${n}`} disabled={disabled || sending} onClick={() => void send(n)}>
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
