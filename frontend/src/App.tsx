import { useMemo, useReducer } from "react";
import { AccountMenu } from "./components/account/AccountMenu";
import { AllTabsPage } from "./components/AllTabsPage";
import { BlendPanel } from "./components/blend/BlendPanel";
import { CatalogError } from "./components/CatalogError";
import { ClaudeBar } from "./components/ClaudeBar";
import { FeedNotes } from "./components/FeedNotes";
import { FeedControls } from "./components/FeedControls";
import { FeedView } from "./components/FeedView";
import { Flash } from "./components/Flash";
import { EditBar } from "./components/EditBar";
import { Footer } from "./components/Footer";
import { FromClaudePanel } from "./components/fromClaude/FromClaudePanel";
import { Header } from "./components/Header";
import { SharedWithYouView } from "./components/inbox/SharedWithYouView";
import { HistorySection } from "./components/library/HistorySection";
import { SavedSection } from "./components/library/SavedSection";
import { NameFeed } from "./components/NameFeed";
import { QuestionCard } from "./components/QuestionCard";
import { SearchBox } from "./components/search/SearchBox";
import { SearchPage } from "./components/search/SearchPage";
import { SettingsLine } from "./components/SettingsLine";
import { ShareButton } from "./components/share/ShareButton";
import { SharePanel } from "./components/share/SharePanel";
import { FinishedSection, WatchingNow } from "./components/Session";
import { TabBar } from "./components/TabBar";
import { UpNextLine } from "./components/UpNextLine";
import { UndoRedo } from "./components/UndoRedo";
import { ViewToggle } from "./components/ViewToggle";
import { myTopics } from "./domain/blend";
import { composeFeed } from "./domain/compose";
import { TOP_RANGE_HOURS } from "./domain/feed";
import { shareStartingVideos } from "./domain/share";
import type { ComposeInput, Video } from "./domain/types";
import type { AccountPort, AssistantPort, CatalogLoader, StateStorage } from "./ports";
import { currentFeedOf, makeReducer } from "./state/appState";
import { providerNotice } from "./domain/assistantInfo";
import { startHistory, withHistory } from "./state/history";
import { restoreState } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { useAccount } from "./state/useAccount";
import { useAccountJumps } from "./state/useAccountJumps";
import { useAssistantInfo } from "./state/useAssistantInfo";
import { useBlend } from "./state/useBlend";
import { useCardActions } from "./state/useCardActions";
import { useCatalog } from "./state/useCatalog";
import { useClaudeBar } from "./state/useClaudeBar";
import { useEditMode } from "./state/useEditMode";
import { useLibrary } from "./state/useLibrary";
import { usePersist } from "./state/usePersist";
import { useRefresh } from "./state/useRefresh";
import { useSearch } from "./state/useSearch";
import { useNotes } from "./state/useNotes";
import { useQuestionCard } from "./state/useQuestionCard";
import { sectionControl, useSections } from "./state/useSections";
import { useSession } from "./state/useSession";
import { useSharedWithYou } from "./state/useSharedWithYou";
import { useShareToggle } from "./state/useShareToggle";
import { useTabs } from "./state/useTabs";

type Props = Readonly<{ loadCatalog: CatalogLoader; storage: StateStorage; assistant: AssistantPort; account: AccountPort }>;

const baseReducer = makeReducer(DEMO_SEED);
const NO_VIDEOS: readonly Video[] = [];
const SHARE_PANEL_ID = "share-panel";
const reducer = withHistory(baseReducer);

/** Reloading leaves an unnamed draft, so it's dropped like any other time you leave it. */
const restore = (storage: StateStorage) =>
  startHistory(baseReducer(restoreState(storage.load(), DEMO_SEED), { type: "leave_draft" }));

export default function App({ loadCatalog, storage, assistant, account: accountPort }: Props) {
  const [history, dispatch] = useReducer(reducer, storage, restore);
  const state = history.present;
  usePersist(storage, state);
  const [catalog, retry] = useCatalog(loadCatalog);

  const feed = currentFeedOf(state);
  const ready = catalog.status === "ready" ? catalog.catalog : null;
  const mine = useMemo(() => myTopics(state.feeds), [state.feeds]);
  const input = useMemo<ComposeInput | null>(
    () =>
      ready && {
        catalog: ready,
        feed,
        filters: state.filters,
        watched: state.watched,
        topMaxAgeHours: TOP_RANGE_HOURS[feed.topRange],
        myTopics: mine,
      },
    [ready, feed, state.filters, state.watched, mine],
  );
  const composed = useMemo(() => input && composeFeed(input), [input]);
  const byId = useMemo(() => new Map((ready ?? []).map((v) => [v.id, v])), [ready]);
  const session = useSession(feed, byId, dispatch);
  const sessionVideos = session.current ? [...session.finished, session.current] : session.finished;
  const notes = useNotes({ feed, videos: sessionVideos, notes: state.notes, assistant, dispatch, showFlash: session.showFlash });
  const library = useLibrary(state, feed, byId, dispatch);
  const cardActions = useCardActions(state, feed, ready ?? NO_VIDEOS, dispatch);
  const pinned = feed.pinned.flatMap((id) => byId.get(id) ?? []);
  const { refresh, undo } = useRefresh(input, dispatch);
  const tabs = useTabs(state, feed, dispatch);
  const shared = useSharedWithYou({ state, feed, catalog: ready, byId, dispatch, openFeed: tabs.open });
  const composition = feed.kind === "shared" ? shared.composition : composed;
  const shareToggle = useShareToggle(feed.name);
  const shareVideos = shareStartingVideos(sessionVideos, pinned, composition?.upNext ?? NO_VIDEOS);
  // With nothing to share the panel has nothing to show, so the button never claims it's open.
  const share = { ...shareToggle, open: shareToggle.open && shareVideos.length > 0 && !shared.inInbox };
  const upNext = [...pinned, ...(composition?.upNext ?? [])];
  const questions = useQuestionCard({ feed, scope: `${tabs.page}:${feed.name}`, byId, dispatch });
  const claudeBar = useClaudeBar({
    assistant,
    feeds: state.feeds,
    feed,
    upNext,
    catalog: ready ?? NO_VIDEOS,
    questions,
    chosenMode: state.barMode,
    dispatch,
  });
  const edit = useEditMode(state.feeds, dispatch);
  const blend = useBlend(state.feeds, feed, ready ?? NO_VIDEOS, dispatch);
  const info = useAssistantInfo(assistant);
  const account = useAccount(accountPort);
  const sections = useSections();
  const jump = useAccountJumps({ feeds: state.feeds, current: feed, tabs, sections, dispatch });
  const search = useSearch({
    catalog: ready ?? NO_VIDEOS,
    recent: state.recentSearches,
    filters: state.filters,
    dispatch,
    openPage: () => {
      edit.stop();
      tabs.openSearch();
    },
  });

  return (
    <div className="app">
      <Header
        onRefresh={() => {
          edit.stop();
          refresh();
        }}
        onUndoRefresh={undo}
        search={
          <SearchBox
            // Opening another feed clears the box, as in the mockup.
            key={feed.name}
            corpus={search.corpus}
            recent={search.recent}
            onSearch={search.search}
            onForget={search.forget}
            onMessage={search.showFlash}
          />
        }
        account={
          <AccountMenu
            counts={{
              feeds: state.feeds.length,
              saved: library.folders.reduce((sum, f) => sum + f.videos.length, 0),
              history: library.history.length,
              shared: state.inbox.shares.length,
              blends: state.blends.length,
            }}
            claudeConnected={state.feeds.some((f) => f.kind === "claude" && f.connected)}
            info={info}
            account={account}
            onJump={jump}
          />
        }
      />
      <TabBar feeds={state.feeds} current={feed} tabs={tabs} edit={edit} unread={shared.unread} />
      {edit.editing && <EditBar edit={edit} onAllTabs={tabs.page === "all"} />}
      <Flash message={account.flash ?? tabs.flash ?? search.flash ?? shared.flash} />
      <main>
        {tabs.page === "all" ? (
          <AllTabsPage feeds={state.feeds} tabs={tabs} edit={edit} />
        ) : tabs.page === "search" ? (
          <SearchPage
            query={search.query}
            results={search.results}
            feedName={feed.name}
            filters={state.filters}
            inSession={library.inSession}
            onPin={library.pin}
            onPlay={session.play}
            saveActions={library.saveActions}
            onBack={tabs.closeSearch}
            flash={session.flash}
          />
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
            <ClaudeBar bar={claudeBar} providerNotice={state.providerNoticeSeen ? null : providerNotice(info)} />
            {feed.draft ? (
              <NameFeed onName={tabs.name} />
            ) : (
              <>
                {feed.kind === "shared" ? (
                  <SharedWithYouView shared={shared} shares={state.inbox.shares} byId={byId} filters={state.filters} />
                ) : (
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
                )}
                <FeedControls
                  feed={feed}
                  onTopRange={(range) => dispatch({ type: "set_top_range", feed: feed.name, range })}
                  onNewsCategory={(category) => dispatch({ type: "set_news_category", feed: feed.name, category })}
                />
                {feed.kind === "claude" && (
                  <FromClaudePanel
                    connected={feed.connected}
                    onConnect={(connected) => dispatch({ type: "set_claude_connection", feed: feed.name, connected })}
                    onSuggest={(request) => void claudeBar.send(request)}
                    thinking={claudeBar.thinking}
                  />
                )}
                {feed.kind === "blend" && <BlendPanel partner={feed.partner} blends={state.blends} controls={blend} />}
                {catalog.status === "loading" && <p className="muted">Loading…</p>}
                {catalog.status === "error" && <CatalogError message={catalog.message} onRetry={retry} />}
                <QuestionCard questions={questions} byId={byId} filters={state.filters} />
                <Flash message={session.flash} />
                {!shared.inInbox && session.finished.length > 0 && (
                  <FinishedSection
                    videos={session.finished}
                    filters={state.filters}
                    noteFor={notes.forVideo}
                    onPlay={session.play}
                    onMoveBack={session.moveBack}
                  />
                )}
                {!shared.inInbox && session.current && (
                  <WatchingNow
                    video={session.current}
                    filters={state.filters}
                    nudge={session.nudge}
                    note={notes.forVideo(session.current.id)}
                    onPlay={session.play}
                    onFinish={session.finish}
                  />
                )}
                {composition && (
                  <UpNextLine
                    feed={feed}
                    composition={composition}
                    pinnedCount={pinned.length}
                    actions={<ShareButton toggle={share} panelId={SHARE_PANEL_ID} />}
                  />
                )}
                {share.open && (
                  <SharePanel
                    id={SHARE_PANEL_ID}
                    feedName={feed.name}
                    videos={shareVideos}
                    notes={state.notes}
                    filters={state.filters}
                    quickSend={state.blends.map((b) => b.name)}
                    onClose={share.close}
                  />
                )}
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
                    cardActions={cardActions}
                  />
                )}
                {!shared.inInbox && <FeedNotes feed={feed} videos={sessionVideos} filters={state.filters} notes={notes} onPlay={session.play} control={sectionControl(sections, "notes")} />}
                <div className="library">
                  <SavedSection library={library} filters={state.filters} onPlay={session.play} control={sectionControl(sections, "saved")} />
                  <HistorySection library={library} filters={state.filters} onPlay={session.play} control={sectionControl(sections, "history")} />
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
