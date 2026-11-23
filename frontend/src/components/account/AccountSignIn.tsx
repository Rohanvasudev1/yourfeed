import { IconBrandGoogle, IconLogout, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { ACCOUNT_TEXT } from "../../domain/account";
import type { AccountControls } from "../../state/useAccount";

type Props = Readonly<{ account: AccountControls }>;

/** The menu's sign-in part: Sign in with Google, or Sign out and Delete my data, or why signing in isn't offered. */
export function AccountSignIn({ account }: Props) {
  const { status, problem } = account;
  return (
    <div className="account-signin">
      {status?.kind === "unavailable" && <p className="popup-hint">{ACCOUNT_TEXT.notSetUp}</p>}
      {status?.kind === "signedOut" && (
        <>
          <button type="button" className="popup-action account-item" onClick={account.signIn}>
            <IconBrandGoogle size={16} aria-hidden="true" />
            <span className="account-item-label">Sign in with Google</span>
          </button>
          <p className="popup-hint">
            {ACCOUNT_TEXT.reads} {ACCOUNT_TEXT.testing}
          </p>
        </>
      )}
      {status?.kind === "signedIn" && <SignedInActions account={account} />}
      {problem && (
        <p className="popup-hint account-problem" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}

function SignedInActions({ account }: Props) {
  const [confirming, setConfirming] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  // The button that asked goes away, so focus moves to the safe answer, and back again on Cancel.
  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (asked.current) deleteButton.current?.focus();
  }, [confirming]);

  if (confirming) {
    return (
      <div className="account-confirm">
        <p className="account-confirm-text">{ACCOUNT_TEXT.confirmDelete}</p>
        <div className="account-confirm-actions">
          <button type="button" className="text-button danger" disabled={account.busy}
            onClick={() => {
              setConfirming(false);
              account.deleteData();
            }}
          >
            Yes, delete everything
          </button>
          <button ref={cancel} type="button" className="text-button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      <button type="button" className="popup-action account-item" disabled={account.busy} onClick={account.signOut}>
        <IconLogout size={16} aria-hidden="true" />
        <span className="account-item-label">Sign out</span>
      </button>
      <button
        ref={deleteButton}
        type="button"
        className="popup-action account-item danger"
        onClick={() => {
          asked.current = true;
          setConfirming(true);
        }}
      >
        <IconTrash size={16} aria-hidden="true" />
        <span className="account-item-label">Delete my data</span>
      </button>
    </>
  );
}
