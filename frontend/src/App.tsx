import { useEffect, useMemo, useReducer, useState } from "react";
import { CatalogError } from "./components/CatalogError";
import { FeedControls } from "./components/FeedControls";
import { FeedView } from "./components/FeedView";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { UpNextLine } from "./components/UpNextLine";
import { ViewToggle } from "./components/ViewToggle";
import { Flash } from "./components/Flash";
import { FinishedSection, WatchingNow } from "./components/Session";
import { composeFeed } from "./domain/compose";
import { TOP_RANGE_HOURS } from "./domain/feed";
import { feedSetOf, nextFeedSet, type FeedSet } from "./domain/refresh";
import { youtubeSearchUrl } from "./domain/session";
import type { Composition, Video } from "./domain/types";
import type { CatalogLoader, StateStorage } from "./ports";
import { currentFeedOf, makeReducer } from "./state/appState";
import { restoreState } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { usePersist } from "./state/usePersist";
import { useReturnNudge } from "./state/useReturnNudge";
import { useTimedValue } from "./state/useTimedValue";

const FLASH_MS = 5000;
const UNDO_REFRESH_MS = 5000;
/** How far a refresh can jump the shuffle seed. */
const SEED_SPREAD = 1000;
const POPUP_BLOCKED = "Your browser blocked the YouTube tab. Allow pop-ups for this page to open videos.";

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
  const ready = catalog.status === "ready" ? catalog.catalog : null;
  const composeInput = useMemo(
    () =>
      ready && {
        catalog: ready,
        feed,
        filters: state.filters,
        watched: state.watched,
        topMaxAgeHours: TOP_RANGE_HOURS[feed.topRange],
      },
    [ready, feed, state.filters, state.watched],
  );
  const composition = useMemo<Composition | null>(() => composeInput && composeFeed(composeInput), [composeInput]);
  const byId = useMemo(() => new Map((ready ?? []).map((v) => [v.id, v])), [ready]);
  const current = feed.current === null ? undefined : byId.get(feed.current);
  const finished = feed.finished.flatMap((id) => byId.get(id) ?? []);
  const [nudge, clearNudge] = useReturnNudge(current !== undefined);
  const [flash, showFlash] = useTimedValue<string>(FLASH_MS);

  const play = (video: Video) => {
    if (!window.open(youtubeSearchUrl(video), "_blank", "noopener")) showFlash(POPUP_BLOCKED);
    clearNudge();
    dispatch({ type: "watch_video", feed: feed.name, video: video.id });
  };
  const [undoRefresh, offerUndoRefresh, dropUndoRefresh] = useTimedValue<FeedSet & { feed: string }>(UNDO_REFRESH_MS);
  const setFeedSet = (name: string, set: FeedSet) => dispatch({ type: "set_feed_set", feed: name, ...set });
  const refresh = () => {
    if (!composeInput) return;
    const seed = feed.seed + 1 + Math.floor(Math.random() * SEED_SPREAD);
    offerUndoRefresh({ feed: feed.name, ...feedSetOf(feed) });
    setFeedSet(feed.name, nextFeedSet(composeInput, seed));
  };
  const undo = undoRefresh && (() => {
    setFeedSet(undoRefresh.feed, undoRefresh);
    dropUndoRefresh();
  });
  const finish = () => {
    clearNudge();
    dispatch({ type: "finish_current", feed: feed.name });
  };

  return (
    <div className="app">
      <Header onRefresh={refresh} onUndoRefresh={undo} />
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
        <Flash message={flash} />
        {finished.length > 0 && (
          <FinishedSection
            videos={finished}
            filters={state.filters}
            onPlay={play}
            onMoveBack={(video) => dispatch({ type: "move_back_to_up_next", feed: feed.name, video: video.id })}
          />
        )}
        {current && (
          <WatchingNow video={current} filters={state.filters} nudge={nudge} onPlay={() => play(current)} onFinish={finish} />
        )}
        {composition && <UpNextLine feed={feed} composition={composition} />}
        {composition && (
          <FeedView
            // Switching layouts or loading a new set starts with every description closed, as in the mockup.
            key={`${state.view}-${feed.seed}`}
            upNext={composition.upNext}
            kind={feed.kind}
            filters={state.filters}
            view={state.view}
            onPlay={play}
          />
        )}
      </main>
      <Footer onReset={() => dispatch({ type: "reset" })} />
    </div>
  );
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Couldn't load videos.");
