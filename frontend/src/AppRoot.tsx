import { useCallback, useMemo, useState } from "react";
import App from "./App";
import { UsernamePrompt } from "./components/account/UsernamePrompt";
import { CatalogError } from "./components/CatalogError";
import { ACCOUNT_TEXT } from "./domain/account";
import type { AccountPort, AssistantPort, CatalogLoader, ServerStatePort, SharingPort, StateStorage } from "./ports";
import { isRestorable, type SavedState } from "./state/persistence";
import { useAccount } from "./state/useAccount";
import { useStateSource } from "./state/useStateSource";

type Props = Readonly<{
  loadCatalog: CatalogLoader;
  /** Demo mode's storage, in the browser. */
  storage: StateStorage;
  /** A signed-in user's storage, on the server. */
  serverState: ServerStatePort;
  assistant: AssistantPort;
  account: AccountPort;
  /** Real share and send, used only when signed in. */
  sharing: SharingPort;
}>;

/** What Bring your demo feeds would copy: the feeds of the demo this browser saved; null when it saved none it can open. */
function savedDemoFeeds(storage: StateStorage) {
  const saved = storage.load();
  return isRestorable(saved) ? (saved as SavedState).state.feeds : null;
}

/** The app, once it knows whose state to show: the server's when signed in (ADR 0012), the browser's in demo mode. */
export function AppRoot({ loadCatalog, storage, serverState, assistant, account: accountPort, sharing }: Props) {
  const account = useAccount(accountPort);
  const [expectsSignedIn] = useState(accountPort.expectsSignedIn);
  const source = useStateSource(account, expectsSignedIn, storage, serverState);
  const signedIn = account.status?.kind === "signedIn";
  const catalogSource = signedIn ? "youtube" : "demo";
  const loadSourceCatalog = useCallback(() => loadCatalog(catalogSource), [loadCatalog, catalogSource]);
  const demoFeeds = useMemo(() => (signedIn ? savedDemoFeeds(storage) : null), [signedIn, storage]);

  if (signedIn && account.status?.kind === "signedIn" && account.status.username === null) {
    return (
      <div className="app">
        <main>
          <UsernamePrompt account={account} />
        </main>
      </div>
    );
  }

  if (source.phase !== "ready") {
    return (
      <div className="app">
        <main>
          {source.phase === "waiting" ? (
            <p className="muted">{ACCOUNT_TEXT.loading}</p>
          ) : (
            <CatalogError message={ACCOUNT_TEXT.loadFailed} onRetry={source.retry}>
              <button type="button" onClick={account.signOut} disabled={account.busy}>
                Sign out
              </button>
            </CatalogError>
          )}
        </main>
      </div>
    );
  }
  return (
    <App
      loadCatalog={loadSourceCatalog}
      storage={source.storage}
      assistant={assistant}
      account={account}
      saveProblem={source.saveFailed ? { retry: source.retrySave } : null}
      demoFeeds={demoFeeds}
      sharing={signedIn ? sharing : null}
    />
  );
}
