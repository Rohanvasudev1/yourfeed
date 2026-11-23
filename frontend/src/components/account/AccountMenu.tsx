import { IconAsterisk, IconBookmark, IconHistory, IconInbox, IconLayoutGrid, IconNotebook, IconUsers, type Icon } from "@tabler/icons-react";
import { answeredByLabel, providerNotice, type AssistantInfo } from "../../domain/assistantInfo";
import type { AccountControls } from "../../state/useAccount";
import type { AccountJump } from "../../state/useAccountJumps";
import { usePopupController } from "../popup/usePopupController";
import { AccountSignIn } from "./AccountSignIn";
import "./account.css";

/** How many of each thing the menu's jumps lead to. */
export type AccountCounts = Readonly<{ feeds: number; saved: number; history: number; shared: number; blends: number }>;

type Props = Readonly<{
  counts: AccountCounts;
  claudeConnected: boolean;
  /** Which assistant answers; `null` until the server says. */
  info: AssistantInfo | null;
  account: AccountControls;
  onJump: (to: AccountJump) => void;
}>;

type Item = Readonly<{ to: AccountJump; icon: Icon; label: string; count?: number }>;

const itemsFor = (counts: AccountCounts, claudeConnected: boolean): readonly Item[] => [
  { to: "all", icon: IconLayoutGrid, label: "All your feeds", count: counts.feeds },
  { to: "saved", icon: IconBookmark, label: "Saved", count: counts.saved },
  { to: "history", icon: IconHistory, label: "Watch history", count: counts.history },
  { to: "notes", icon: IconNotebook, label: "Feed notes" },
  { to: "shared", icon: IconInbox, label: "Shared with you", count: counts.shared },
  { to: "blend", icon: IconUsers, label: "Blends", count: counts.blends },
  { to: "claude", icon: IconAsterisk, label: claudeConnected ? "Claude connected" : "Connect Claude" },
];

/** The avatar button and its menu: who you are, jumps with counts, which assistant answers, and signing in or out. */
export function AccountMenu({ counts, claudeConnected, info, account, onJump }: Props) {
  const popups = usePopupController<"account">();
  const jump = (to: AccountJump) => {
    popups.finish();
    onJump(to);
  };

  return (
    <div className="account">
      <button type="button" className="account-avatar" aria-label="Your account" title="Your account" {...popups.trigger("account")}>
        Y
      </button>
      {popups.openKey === "account" && (
        <div className="popup account-menu" aria-label="Your account" {...popups.popup("account")}>
          <div className="account-head">
            <span className="account-avatar" aria-hidden="true">
              Y
            </span>
            <div>
              <p className="account-name">You</p>
              <p className="account-handle">{account.status?.kind === "signedIn" ? "Signed in with Google" : "@you · demo account"}</p>
            </div>
          </div>
          {itemsFor(counts, claudeConnected).map(({ to, icon: ItemIcon, label, count }) => (
            <button key={to} type="button" className="popup-action account-item" onClick={() => jump(to)}>
              <ItemIcon size={16} aria-hidden="true" />
              <span className="account-item-label">{label}</span>
              {count !== undefined && <span className="account-count">{count}</span>}
            </button>
          ))}
          <div className="account-assistant">
            {info && <p className="account-answers">{answeredByLabel(info)}</p>}
            <p className="popup-hint">{providerNotice(info)}</p>
          </div>
          <AccountSignIn account={account} />
        </div>
      )}
    </div>
  );
}
