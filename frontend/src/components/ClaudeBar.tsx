import { IconArrowUp, IconAsterisk, IconLoader2 } from "@tabler/icons-react";
import type { ClaudeBarState } from "../state/useClaudeBar";
import { BarModeSwitch } from "./BarModeSwitch";
import "./claudeBar.css";

const placeholderFor = (bar: ClaudeBarState) =>
  bar.mode === "edit" && bar.hasSwitch ? `Tell Claude what to change in ${bar.feedName}` : "Tell Claude what you want to watch";

type Props = Readonly<{
  bar: ClaudeBarState;
  /** Where requests go, shown until the first one is sent; `null` once it has been. */
  providerNotice: string | null;
}>;

/** The ids an element is described by, leaving out the ones not shown. */
const describedBy = (...ids: (string | false)[]) => ids.filter(Boolean).join(" ") || undefined;

/** The plain-language command box: a request goes to the assistant and its feed actions land on this feed. */
export function ClaudeBar({ bar, providerNotice }: Props) {
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
          aria-describedby={describedBy(!!bar.error && "cbar-error", !!providerNotice && "cbar-provider")}
          aria-invalid={bar.error ? true : undefined}
          placeholder={placeholderFor(bar)}
          value={bar.text}
          onChange={(event) => bar.setText(event.target.value)}
        />
        {bar.thinking && <span className="cbar-thinking">Thinking…</span>}
        {bar.hasSwitch && <BarModeSwitch mode={bar.mode} feedName={bar.feedName} locked={bar.modeLocked} onChange={bar.setMode} />}
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
      {providerNotice && (
        <p id="cbar-provider" className="cbar-notice" role="note" aria-label="Provider notice">
          {providerNotice}
        </p>
      )}
      <div role="status" aria-label="AI busy notice">
        {bar.busyNotice && <p className="cbar-notice">{bar.busyNotice}</p>}
      </div>
    </div>
  );
}
