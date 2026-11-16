import { useMemo, useReducer } from "react";
import { AllTabsPage } from "./components/AllTabsPage";
import { CatalogError } from "./components/CatalogError";
import { FeedNotes } from "./components/FeedNotes";
import { FeedControls } from "./components/FeedControls";
import { FeedView } from "./components/FeedView";
import { Flash } from "./components/Flash";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { HistorySection } from "./components/library/HistorySection";
import { SavedSection } from "./components/library/SavedSection";
import { NameFeed } from "./components/NameFeed";
import { SettingsLine } from "./components/SettingsLine";
import { FinishedSection, WatchingNow } from "./components/Session";
import { TabBar } from "./components/TabBar";
import { UpNextLine } from "./components/UpNextLine";
import { UndoRedo } from "./components/UndoRedo";
import { ViewToggle } from "./components/ViewToggle";
import { composeFeed } from "./domain/compose";
import { TOP_RANGE_HOURS } from "./domain/feed";
import type { ComposeInput } from "./domain/types";
import type { CatalogLoader, StateStorage } from "./ports";
import { currentFeedOf, makeReducer } from "./state/appState";
import { startHistory, withHistory } from "./state/history";
import { restoreState } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { useCatalog } from "./state/useCatalog";
import { useLibrary } from "./state/useLibrary";
import { usePersist } from "./state/usePersist";
import { useRefresh } from "./state/useRefresh";
import { useNotes } from "./state/useNotes";
import { useSession } from "./state/useSession";
import { useTabs } from "./state/useTabs";

type Props = Readonly<{ loadCatalog: CatalogLoader; storage: StateStorage }>;

const baseReducer = makeReducer(DEMO_SEED);
const reducer = withHistory(baseReducer);

/** Reloading leaves an unnamed draft, so it's dropped like any other time you leave it. */
const restore = (storage: StateStorage) =>
  startHistory(baseReducer(restoreState(storage.load(), DEMO_SEED), { type: "leave_draft" }));

export default function App({ loadCatalog, storage }: Props) {
  const [history, dispatch] = useReducer(reducer, storage, restore);
  const state = history.present;
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
  const sessionVideos = session.current ? [...session.finished, session.current] : session.finished;
  const notes = useNotes({ feed, videos: sessionVideos, notes: state.notes, dispatch, showFlash: session.showFlash });
  const library = useLibrary(state, feed, byId, dispatch);
  const pinned = feed.pinned.flatMap((id) => byId.get(id) ?? []);
  const { refresh, undo } = useRefresh(input, dispatch);
  const tabs = useTabs(state, feed, dispatch);

  return (
    <div className="app">
      <Header onRefresh={refresh} onUndoRefresh={undo} />
      <TabBar feeds={state.feeds} current={feed} tabs={tabs} />
      <Flash message={tabs.flash} />
      <main>
        {tabs.page === "all" ? (
          <AllTabsPage feeds={state.feeds} tabs={tabs} />
        ) : (
          <>
            <div className="feed-toolbar">
              <h2 className="feed-title">{feed.name}</h2>
              <div className="toolbar-actions">
                <UndoRedo
                  undoCount={history.undo.length}
                  redoCount={history.redo.length}
                  onUndo={() => dispatch({ type: "undo" })}
                  onRedo={() => dispatch({ type: "redo" })}
                />
                <ViewToggle view={state.view} onChange={(view) => dispatch({ type: "setView", view })} />
              </div>
            </div>
            {feed.draft ? (
              <NameFeed onName={tabs.name} />
            ) : (
              <>
                <SettingsLine
                  // Each feed opens with its popups closed, so one never shows another feed's options.
                  key={feed.name}
                  feed={feed}
                  tabOptions={tabs}
                  filters={state.filters}
                  topicActions={{
                    onAdd: (item) => dispatch({ type: "add_to_feed", feed: feed.name, item }),
                    onRemove: (item) => dispatch({ type: "remove_from_feed", feed: feed.name, item }),
                    onMute: (topic) => dispatch({ type: "mute_topic", feed: feed.name, topic }),
                    onUnmute: (topic) => dispatch({ type: "unmute_topic", feed: feed.name, topic }),
                  }}
                  rangeActions={{
                    onLength: (range) => dispatch({ type: "set_length_range", feed: feed.name, range }),
                    onSession: (range) => dispatch({ type: "set_session_range", feed: feed.name, range }),
                  }}
                  onToggleFilter={(filter) => dispatch({ type: "toggle_filter", filter })}
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
                  <FinishedSection
                    videos={session.finished}
                    filters={state.filters}
                    noteFor={notes.forVideo}
                    onPlay={session.play}
                    onMoveBack={session.moveBack}
                  />
                )}
                {session.current && (
                  <WatchingNow
                    video={session.current}
                    filters={state.filters}
                    nudge={session.nudge}
                    note={notes.forVideo(session.current.id)}
                    onPlay={session.play}
                    onFinish={session.finish}
                  />
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
                    saveActions={library.saveActions}
                  />
                )}
                <FeedNotes feed={feed} videos={sessionVideos} filters={state.filters} notes={notes} onPlay={session.play} />
                <div className="library">
                  <SavedSection library={library} filters={state.filters} onPlay={session.play} />
                  <HistorySection library={library} filters={state.filters} onPlay={session.play} />
                </div>
              </>
            )}
          </>
        )}
      </main>
      <Footer onReset={() => dispatch({ type: "reset" })} />
    </div>
  );
}
