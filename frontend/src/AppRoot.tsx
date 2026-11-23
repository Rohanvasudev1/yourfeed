import { useCallback, useMemo, useState } from "react";
import App from "./App";
import { UsernamePrompt } from "./components/account/UsernamePrompt";
import { CatalogError } from "./components/CatalogError";
import { ACCOUNT_TEXT } from "./domain/account";
import type { AccountPort, AssistantPort, CatalogLoader, ServerStatePort, StateStorage } from "./ports";
import { restoreState } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
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
}>;

/** The app, once it knows whose state to show: the server's when signed in (ADR 0012), the browser's in demo mode. */
export function AppRoot({ loadCatalog, storage, serverState, assistant, account: accountPort }: Props) {
  const account = useAccount(accountPort);
  const [expectsSignedIn] = useState(accountPort.expectsSignedIn);
  const source = useStateSource(account, expectsSignedIn, storage, serverState);
  const signedIn = account.status?.kind === "signedIn";
  const catalogSource = signedIn ? "youtube" : "demo";
  const loadSourceCatalog = useCallback(() => loadCatalog(catalogSource), [loadCatalog, catalogSource]);
  // What Bring your demo feeds would copy: the demo as this browser keeps it.
  const demoFeeds = useMemo(() => (signedIn ? restoreState(storage.load(), DEMO_SEED).feeds : null), [signedIn, storage]);

  if (account.status?.kind === "signedIn" && account.status.username === null) {
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
    />
  );
}
