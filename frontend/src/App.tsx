import { useMemo, useReducer } from "react";
import { CatalogError } from "./components/CatalogError";
import { FeedControls } from "./components/FeedControls";
import { FeedView } from "./components/FeedView";
import { Flash } from "./components/Flash";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { HistorySection } from "./components/library/HistorySection";
import { SavedSection } from "./components/library/SavedSection";
import { SettingsLine } from "./components/SettingsLine";
import { FinishedSection, WatchingNow } from "./components/Session";
import { TabBar } from "./components/TabBar";
import { UpNextLine } from "./components/UpNextLine";
import { ViewToggle } from "./components/ViewToggle";
import { composeFeed } from "./domain/compose";
import { TOP_RANGE_HOURS } from "./domain/feed";
import type { ComposeInput } from "./domain/types";
import type { CatalogLoader, StateStorage } from "./ports";
import { currentFeedOf, makeReducer } from "./state/appState";
import { restoreState } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { useCatalog } from "./state/useCatalog";
import { useLibrary } from "./state/useLibrary";
import { usePersist } from "./state/usePersist";
import { useRefresh } from "./state/useRefresh";
import { useSession } from "./state/useSession";

type Props = Readonly<{ loadCatalog: CatalogLoader; storage: StateStorage }>;

const reducer = makeReducer(DEMO_SEED);

const restore = (storage: StateStorage) => restoreState(storage.load(), DEMO_SEED);

export default function App({ loadCatalog, storage }: Props) {
  const [state, dispatch] = useReducer(reducer, storage, restore);
  usePersist(storage, state);
  const [catalog, retry] = useCatalog(loadCatalog);

  const feed = currentFeedOf(state);
  const ready = catalog.status === "ready" ? catalog.catalog : null;
  const input = useMemo<ComposeInput | null>(
    () =>
      ready && { catalog: ready, feed, filters: state.filters, watched: state.watched, topMaxAgeHours: TOP_RANGE_HOURS[feed.topRange] },
    [ready, feed, state.filters, state.watched],
  );
  const composition = useMemo(() => input && composeFeed(input), [input]);
  const byId = useMemo(() => new Map((ready ?? []).map((v) => [v.id, v])), [ready]);
  const session = useSession(feed, byId, dispatch);
  const library = useLibrary(state, feed, byId, dispatch);
  const pinned = feed.pinned.flatMap((id) => byId.get(id) ?? []);
  const { refresh, undo } = useRefresh(input, dispatch);

  return (
    <div className="app">
      <Header onRefresh={refresh} onUndoRefresh={undo} />
      <TabBar feeds={state.feeds} current={feed} onOpen={(name) => dispatch({ type: "open_feed", feed: name })} />
      <main>
        <div className="feed-toolbar">
          <h2 className="feed-title">{feed.name}</h2>
          <ViewToggle view={state.view} onChange={(view) => dispatch({ type: "setView", view })} />
        </div>
        <SettingsLine
          feed={feed}
          filters={state.filters}
          topicActions={{
            onAdd: (item) => dispatch({ type: "add_to_feed", feed: feed.name, item }),
            onRemove: (item) => dispatch({ type: "remove_from_feed", feed: feed.name, item }),
            onMute: (topic) => dispatch({ type: "mute_topic", feed: feed.name, topic }),
            onUnmute: (topic) => dispatch({ type: "unmute_topic", feed: feed.name, topic }),
          }}
        />
        <FeedControls
          feed={feed}
          onTopRange={(range) => dispatch({ type: "set_top_range", feed: feed.name, range })}
          onNewsCategory={(category) => dispatch({ type: "set_news_category", feed: feed.name, category })}
        />
        {catalog.status === "loading" && <p className="muted">Loading…</p>}
        {catalog.status === "error" && <CatalogError message={catalog.message} onRetry={retry} />}
        <Flash message={session.flash} />
        {session.finished.length > 0 && (
          <FinishedSection videos={session.finished} filters={state.filters} onPlay={session.play} onMoveBack={session.moveBack} />
        )}
        {session.current && (
          <WatchingNow video={session.current} filters={state.filters} nudge={session.nudge} onPlay={session.play} onFinish={session.finish} />
        )}
        {composition && <UpNextLine feed={feed} composition={composition} pinnedCount={pinned.length} />}
        {composition && (
          <FeedView
            // Switching layouts or loading a new set starts with every description closed, as in the mockup.
            key={`${state.view}-${feed.seed}`}
            pinned={pinned}
            upNext={composition.upNext}
            kind={feed.kind}
            filters={state.filters}
            view={state.view}
            onPlay={session.play}
            saving={library.saving}
          />
        )}
        <div className="library">
          <SavedSection library={library} filters={state.filters} onPlay={session.play} />
          <HistorySection library={library} filters={state.filters} onPlay={session.play} />
        </div>
      </main>
      <Footer onReset={() => dispatch({ type: "reset" })} />
    </div>
  );
}
