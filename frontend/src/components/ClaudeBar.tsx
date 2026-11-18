import { IconArrowUp, IconAsterisk, IconLoader2 } from "@tabler/icons-react";
import type { ClaudeBarState } from "../state/useClaudeBar";
import "./claudeBar.css";

const PLACEHOLDER = "Tell Claude what you want to watch";

/** The plain-language command box: a request goes to the assistant and its feed actions land on this feed. */
export function ClaudeBar({ bar }: Readonly<{ bar: ClaudeBarState }>) {
  return (
    <div className="claude">
      <form
        className="cbar"
        onSubmit={(event) => {
          event.preventDefault();
          void bar.send();
        }}
      >
        <IconAsterisk className="cbar-mark" size={17} aria-hidden="true" />
        <input
          type="text"
          aria-label="Tell Claude what to change"
          aria-describedby={bar.error ? "cbar-error" : undefined}
          aria-invalid={bar.error ? true : undefined}
          placeholder={PLACEHOLDER}
          value={bar.text}
          onChange={(event) => bar.setText(event.target.value)}
        />
        {bar.thinking && <span className="cbar-thinking">Thinking…</span>}
        <button type="submit" className="cbar-send" aria-label={bar.thinking ? "Thinking…" : "Send to Claude"} title={bar.thinking ? "Thinking…" : "Send to Claude"} disabled={bar.thinking}>
          {bar.thinking ? <IconLoader2 className="cbar-spin" size={17} aria-hidden="true" /> : <IconArrowUp size={17} aria-hidden="true" />}
        </button>
      </form>
      {bar.error && (
        <p id="cbar-error" className="cbar-error" role="alert">
          {bar.error}
        </p>
      )}
      {/* Always rendered, so screen readers announce each reply as it arrives. */}
      <div role="status" aria-label="Claude's reply">
        {bar.reply && (
          <p className="cbar-reply">
            <IconAsterisk className="cbar-mark" size={15} aria-hidden="true" />
            {bar.reply}
          </p>
        )}
      </div>
    </div>
  );
}
