import { IconChevronDown, IconChevronRight, IconHistory, IconX } from "@tabler/icons-react";
import { useId, useState } from "react";
import { initialOf, type BlendPartner } from "../../domain/blend";

type Props = Readonly<{
  blends: readonly BlendPartner[];
  /** The name of the blend open in the feed, if any. */
  open: string | null;
  onOpen: (name: string) => void;
  onForget: (name: string) => void;
}>;

/** The visitor's blends, newest first: open one in the Blend feed, or remove it. Starts expanded, as in the mockup. */
export function PreviousBlends({ blends, open, onOpen, onForget }: Props) {
  const [expanded, setExpanded] = useState(true);
  const listId = useId();
  const Chevron = expanded ? IconChevronDown : IconChevronRight;
  return (
    <section className="blend-history" aria-label="Previous blends">
      <button type="button" className="section-toggle" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(!expanded)}>
        <Chevron size={16} aria-hidden="true" />
        <IconHistory size={17} aria-hidden="true" />
        <span className="section-toggle-name">Previous blends</span>
        <span className="muted small">{blends.length}</span>
      </button>
      {expanded && (
        <ul id={listId} className="blend-list">
          {blends.map((b) => (
            <BlendRow key={b.name} blend={b} isOpen={b.name === open} onOpen={() => onOpen(b.name)} onForget={() => onForget(b.name)} />
          ))}
        </ul>
      )}
    </section>
  );
}

type RowProps = Readonly<{ blend: BlendPartner; isOpen: boolean; onOpen: () => void; onForget: () => void }>;

function BlendRow({ blend, isOpen, onOpen, onForget }: RowProps) {
  return (
    <li className={isOpen ? "blend-item on" : "blend-item"}>
      <button type="button" className="blend-open" aria-label={`Open blend with @${blend.name}`} aria-current={isOpen} onClick={onOpen}>
        <span className="blend-avatar them" aria-hidden="true">
          {initialOf(blend.name)}
        </span>
        <span className="blend-open-text">
          <span className="blend-open-name">You + @{blend.name}</span>
          <span className="blend-open-desc">
            {blend.score}% match · {blend.topics.join(", ")}
          </span>
        </span>
        {isOpen && <span className="blend-badge">Open</span>}
      </button>
      <button type="button" className="icon-button" aria-label={`Remove blend with @${blend.name}`} title="Remove" onClick={onForget}>
        <IconX size={15} aria-hidden="true" />
      </button>
    </li>
  );
}
