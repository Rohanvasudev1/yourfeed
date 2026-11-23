import { IconClockHour4, IconFlask, IconRefresh, IconSend, IconUsers } from "@tabler/icons-react";
import { useId, useState, type FormEvent } from "react";
import type { Blend, BlendPartner, ServerBlend } from "../../domain/blend";
import { cleanUsername, usernameProblem } from "../../domain/username";
import type { BlendControls } from "../../state/useBlend";
import { initialOf } from "../../domain/blend";
import { BlendAvatars, MatchScore } from "./BlendBits";
import { PreviousBlends } from "./PreviousBlends";
import "./blend.css";

type Props = Readonly<{ partner: Blend | null; blends: readonly BlendPartner[]; controls: BlendControls }>;

/** The Blend feed's panel under the settings line: ask for a username, wait for approval, or show who you blend with. */
export function BlendPanel({ partner, blends, controls }: Props) {
  return (
    <>
      {controls.invites.length > 0 && <InvitesToMe invites={controls.invites} onAccept={controls.accept} onDecline={controls.decline} />}
      {partner === null ? (
        <InviteForm canInvite={controls.canInvite} onInvite={controls.invite} />
      ) : partner.status === "pending" ? (
        <PendingInvite name={partner.name} onCancel={controls.clear} onApprove={controls.simulated ? controls.approve : null} />
      ) : (
        <BlendHeader partner={partner} onChange={controls.clear} />
      )}
      {blends.length > 0 && (
        <PreviousBlends blends={blends} open={partner?.status === "accepted" ? partner.name : null} onOpen={controls.open} onForget={controls.forget} />
      )}
      {controls.problem && (
        <p className="field-error" role="alert">
          {controls.problem}
        </p>
      )}
    </>
  );
}

type InviteProps = Readonly<{ canInvite: boolean; onInvite: (name: string) => Promise<string | null> }>;

function InviteForm({ canInvite, onInvite }: InviteProps) {
  const headingId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!canInvite) return;
    const username = cleanUsername(name);
    const problem = usernameProblem(username, []);
    setError(problem ?? (await onInvite(username)));
  };

  return (
    <section className="blend-panel" aria-labelledby={headingId}>
      <IconUsers size={24} className="blend-icon" aria-hidden="true" />
      <div className="blend-body">
        <h3 id={headingId}>Blend with a friend</h3>
        <p>
          Mix your taste with someone else's into one shared feed. Type their username to send an invite. The blend starts once they approve it
          in their account.
        </p>
        <form className="blend-row" onSubmit={send}>
          <input
            type="text"
            aria-label="Their Yourfeed username"
            placeholder="@username"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          <button type="submit" className="text-button" disabled={!canInvite}>
            <IconSend size={15} aria-hidden="true" />
            Send invite
          </button>
        </form>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/** `onApprove` simulates their approval: demo mode only, null when signed in. */
type PendingProps = Readonly<{ name: string; onCancel: () => void; onApprove: (() => void) | null }>;

function PendingInvite({ name, onCancel, onApprove }: PendingProps) {
  const headingId = useId();
  return (
    <section className="blend-panel" aria-labelledby={headingId}>
      <IconClockHour4 size={24} className="blend-icon" aria-hidden="true" />
      <div className="blend-body">
        <h3 id={headingId}>Invite sent to @{name}</h3>
        <p>
          @{name} needs to approve it in their Yourfeed account. Your blend appears here once they do. Nothing about their taste is shared until
          then.
        </p>
        <div className="blend-row">
          <button type="button" className="text-button" onClick={onCancel}>
            Cancel invite
          </button>
          {onApprove && (
            <button
              type="button"
              className="text-button blend-demo"
              aria-label="Simulate their approval (demo only)"
              title="Demo only: pretend they approved"
              onClick={onApprove}
            >
              <IconFlask size={15} aria-hidden="true" />
              Simulate their approval
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function BlendHeader({ partner, onChange }: Readonly<{ partner: BlendPartner; onChange: () => void }>) {
  const headingId = useId();
  return (
    <section className="blend-header" aria-labelledby={headingId}>
      <BlendAvatars name={partner.name} />
      <h3 id={headingId}>You + @{partner.name}</h3>
      <MatchScore score={partner.score} />
      <button type="button" className="icon-button blend-change" aria-label="Blend with someone else" title="Change" onClick={onChange}>
        <IconRefresh size={16} aria-hidden="true" />
      </button>
    </section>
  );
}

type InvitesProps = Readonly<{ invites: readonly ServerBlend[]; onAccept: (id: number) => void; onDecline: (id: number) => void }>;

/** Signed in: invites others sent this user, to approve (which opens the blend) or decline. */
function InvitesToMe({ invites, onAccept, onDecline }: InvitesProps) {
  return (
    <section className="blend-history" aria-label="Blend invites">
      <ul className="blend-list">
        {invites.map((invite) => (
          <li key={invite.id} className="blend-item">
            <span className="blend-avatar them" aria-hidden="true">
              {initialOf(invite.with)}
            </span>
            <span className="blend-open-text">@{invite.with} wants to blend with you</span>
            <button type="button" className="text-button" aria-label={`Approve blend with @${invite.with}`} onClick={() => onAccept(invite.id)}>
              Approve
            </button>
            <button type="button" className="text-button" aria-label={`Decline blend with @${invite.with}`} onClick={() => onDecline(invite.id)}>
              Decline
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
