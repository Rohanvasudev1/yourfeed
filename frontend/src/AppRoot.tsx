import { useCallback, useMemo, useState } from "react";
import App from "./App";
import { UsernamePrompt } from "./components/account/UsernamePrompt";
import { CatalogError } from "./components/CatalogError";
import { ShowcasePage } from "./components/showcase/ShowcasePage";
import { ACCOUNT_TEXT } from "./domain/account";
import type { AccountPort, AssistantPort, CatalogLoader, ServerStatePort, SharingPort, StateStorage, TopicSearchPort } from "./ports";
import { isRestorable, type SavedState } from "./state/persistence";
import { useAccount } from "./state/useAccount";
import { useRoute } from "./state/useRoute";
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
  /** Topic searches for feeds' topics outside subscriptions, used only when signed in. */
  searchTopics: TopicSearchPort;
}>;

/** What Bring your demo feeds would copy: the feeds of the demo this browser saved; null when it saved none it can open. */
function savedDemoFeeds(storage: StateStorage) {
  const saved = storage.load();
  return isRestorable(saved) ? (saved as SavedState).state.feeds : null;
}

/** The page the address names: the showcase at /about (ADR 0014), the app anywhere else. */
export function AppRoot(props: Props) {
  const route = useRoute();
  return route === "about" ? <ShowcasePage loadCatalog={props.loadCatalog} assistant={props.assistant} /> : <AccountApp {...props} />;
}

/** The app, once it knows whose state to show: the server's when signed in (ADR 0012), the browser's in demo mode. */
function AccountApp({ loadCatalog, storage, serverState, assistant, account: accountPort, sharing, searchTopics }: Props) {
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
      searchTopics={signedIn ? searchTopics : null}
    />
  );
}
