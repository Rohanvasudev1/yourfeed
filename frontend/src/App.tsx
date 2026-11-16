import { useEffect, useReducer, useState } from "react";
import { CatalogError } from "./components/CatalogError";
import { FeedControls } from "./components/FeedControls";
import { FeedView } from "./components/FeedView";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { ViewToggle } from "./components/ViewToggle";
import type { Video } from "./domain/types";
import type { CatalogLoader, StateStorage } from "./ports";
import { currentFeedOf, makeReducer } from "./state/appState";
import { restoreState } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { usePersist } from "./state/usePersist";

type Props = Readonly<{ loadCatalog: CatalogLoader; storage: StateStorage }>;

type CatalogState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "error"; message: string }>
  | Readonly<{ status: "ready"; catalog: readonly Video[] }>;

const reducer = makeReducer(DEMO_SEED);

const restore = (storage: StateStorage) => restoreState(storage.load(), DEMO_SEED);

export default function App({ loadCatalog, storage }: Props) {
  const [state, dispatch] = useReducer(reducer, storage, restore);
  usePersist(storage, state);
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setCatalog({ status: "loading" });
    loadCatalog()
      .then((videos) => live && setCatalog({ status: "ready", catalog: videos }))
      .catch((err: unknown) => {
        console.error("Catalog failed to load", err);
        if (live) setCatalog({ status: "error", message: errorMessage(err) });
      });
    return () => {
      live = false;
    };
  }, [loadCatalog, attempt]);

  const feed = currentFeedOf(state);
  return (
    <div className="app">
      <Header />
      <TabBar feeds={state.feeds} current={feed} onOpen={(name) => dispatch({ type: "open_feed", feed: name })} />
      <main>
        <div className="feed-toolbar">
          <h2 className="feed-title">{feed.name}</h2>
          <ViewToggle view={state.view} onChange={(view) => dispatch({ type: "setView", view })} />
        </div>
        <FeedControls
          feed={feed}
          onTopRange={(range) => dispatch({ type: "set_top_range", feed: feed.name, range })}
          onNewsCategory={(category) => dispatch({ type: "set_news_category", feed: feed.name, category })}
        />
        {catalog.status === "loading" && <p className="muted">Loading…</p>}
        {catalog.status === "error" && (
          <CatalogError message={catalog.message} onRetry={() => setAttempt((n) => n + 1)} />
        )}
        {catalog.status === "ready" && (
          <FeedView
            // Switching layouts starts with every description closed, as in the mockup.
            key={state.view}
            catalog={catalog.catalog}
            feed={feed}
            filters={state.filters}
            watched={state.watched}
            view={state.view}
          />
        )}
      </main>
      <Footer onReset={() => dispatch({ type: "reset" })} />
    </div>
  );
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Couldn't load videos.");
