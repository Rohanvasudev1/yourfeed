import { IconAsterisk, IconPlugConnected, IconPlugConnectedX } from "@tabler/icons-react";
import { useEffect, useId, useRef } from "react";
import { CLAUDE_SUGGESTIONS, CLAUDE_WORK } from "../../domain/fromClaude";
import "./fromClaude.css";

const DEMO_NOTE = "Demo only: the summary is made up, and nothing is read from Claude.";

type Props = Readonly<{
  connected: boolean;
  onConnect: (connected: boolean) => void;
  /** Sends a suggestion through the Claude bar. */
  onSuggest: (request: string) => void;
  /** While the Claude bar is waiting on an answer, suggestions can't be sent. */
  thinking: boolean;
}>;

/** From Claude's extra panel: the Connect Claude step, or the connected summary with suggestion chips. */
export function FromClaudePanel({ connected, onConnect, onSuggest, thinking }: Props) {
  const connectButton = useRef<HTMLButtonElement>(null);
  const disconnectButton = useRef<HTMLButtonElement>(null);
  // Only a click here moves focus: the button pressed is gone, so focus goes to the one that replaced it.
  const toggled = useRef(false);

  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    (connected ? disconnectButton : connectButton).current?.focus();
  }, [connected]);

  const toggle = (next: boolean) => {
    toggled.current = true;
    onConnect(next);
  };

  return connected ? (
    <ConnectedPanel buttonRef={disconnectButton} onDisconnect={() => toggle(false)} onSuggest={onSuggest} thinking={thinking} />
  ) : (
    <section className="from-claude" aria-label="Connect Claude">
      <IconAsterisk className="from-claude-mark" size={26} aria-hidden="true" />
      <div>
        <h3>Build a feed from your Claude work</h3>
        <p className="from-claude-text">
          Claude shares a short summary of what you've been working on recently. Nothing else from your chats is shared, and you can edit or remove any
          topic.
        </p>
        <button ref={connectButton} type="button" className="text-button" onClick={() => toggle(true)}>
          <IconPlugConnected size={15} aria-hidden="true" />
          Connect Claude
        </button>
        <p className="from-claude-demo muted">{DEMO_NOTE}</p>
      </div>
    </section>
  );
}

type ConnectedProps = Readonly<{
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onDisconnect: () => void;
  onSuggest: (request: string) => void;
  thinking: boolean;
}>;

function ConnectedPanel({ buttonRef, onDisconnect, onSuggest, thinking }: ConnectedProps) {
  const chipsLabel = useId();
  return (
    <section className="from-claude from-claude-connected" aria-label="From your recent Claude work">
      <div className="from-claude-head">
        <h3>
          <IconAsterisk className="from-claude-mark" size={15} aria-hidden="true" />
          From your recent Claude work
        </h3>
        <button ref={buttonRef} type="button" className="icon-button" aria-label="Disconnect Claude" title="Disconnect" onClick={onDisconnect}>
          <IconPlugConnectedX size={16} aria-hidden="true" />
        </button>
      </div>
      <ul className="from-claude-work">
        {CLAUDE_WORK.map((work) => (
          <li key={work.label}>
            <span>{work.label}</span>
            <span className="muted">{work.topics.join(", ")}</span>
          </li>
        ))}
      </ul>
      <div className="from-claude-ask" role="group" aria-labelledby={chipsLabel}>
        <p id={chipsLabel}>What would you like to add?</p>
        <div className="from-claude-chips">
          {CLAUDE_SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" className="from-claude-chip" disabled={thinking} onClick={() => onSuggest(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </div>
      <p className="from-claude-demo muted">{DEMO_NOTE}</p>
    </section>
  );
}
