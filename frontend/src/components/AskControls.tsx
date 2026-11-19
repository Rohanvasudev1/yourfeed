import { IconAsterisk } from "@tabler/icons-react";
import { ANSWER_MARK } from "../domain/askNotes";
import type { AskBinding } from "../state/useAskNotes";

const ASK_HINT = "Ask Claude: end a line with ? and press Enter. The answer appears on the next line.";

/** The ✱ button beside a video's notes. `subject` names the notes, e.g. "notes on <title>". */
export function AskButton({ ask, subject }: Readonly<{ ask: AskBinding; subject: string }>) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={`Answer my last question in ${subject}`}
      title="Answer my last question"
      onClick={ask.askLast}
    >
      <IconAsterisk size={16} className="answer-mark" aria-hidden="true" />
    </button>
  );
}

/** How to ask, under the notes box, or the latest error or no-op message in its place. */
export function AskHint({ message }: Readonly<{ message: string | null }>) {
  return (
    <p className={message ? "note-hint error" : "note-hint"} aria-live="polite">
      {message ?? (
        <>
          <span className="answer-mark" aria-hidden="true">
            {ANSWER_MARK}{" "}
          </span>
          <span>{ASK_HINT}</span>
        </>
      )}
    </p>
  );
}
