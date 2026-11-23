import { IconArrowsExchange } from "@tabler/icons-react";
import type { MirrorState } from "../../state/useMirror";
import "./mirror.css";

/** The recipe mirror's proposal: what behaviour disagrees with, and a change to accept or dismiss for 7 days (ADR 0010). */
export function MirrorCard({ mirror }: Readonly<{ mirror: MirrorState }>) {
  const { proposal } = mirror;
  if (!proposal) return null;
  return (
    <section className="mirror-card" aria-label="Recipe mirror">
      <IconArrowsExchange size={16} className="mirror-mark" aria-hidden="true" />
      <p className="mirror-text">{proposal.text}</p>
      <div className="mirror-actions">
        <button type="button" className="mirror-accept" onClick={() => mirror.accept(proposal)}>
          {proposal.accept}
        </button>
        <button type="button" className="mirror-dismiss" onClick={() => mirror.dismiss(proposal)} title="Hidden for 7 days">
          Dismiss
        </button>
      </div>
    </section>
  );
}
