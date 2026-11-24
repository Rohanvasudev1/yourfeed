import { useEffect, useMemo } from "react";
import { AccountMenu } from "./components/account/AccountMenu";
import { DemoFeedsOfferCard } from "./components/account/DemoFeedsOfferCard";
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
import { MirrorCard } from "./components/mirror/MirrorCard";
import { NameFeed } from "./components/NameFeed";
import { QuestionCard } from "./components/QuestionCard";
import { RecipeLog } from "./components/recipeLog/RecipeLog";
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
import { withChannelTopics, type ChannelTopics } from "./domain/channelTopics";
import { composeFeed } from "./domain/compose";
import { shareStartingVideos } from "./domain/share";
import { CATALOG_REASON, reasonText, type Reason } from "./domain/rank";
import { hasSessionStarted } from "./domain/session";
import type { Feed, Video } from "./domain/types";
import type { AssistantPort, SharingPort, SourceCatalogLoader, StateStorage, TopicSearchPort } from "./ports";
import { withFoundVideos } from "./domain/topicSearch";
import { NO_SUBSCRIPTIONS, subscribedChannels } from "./domain/following";
import { currentFeedOf } from "./state/appState";
import { providerNotice } from "./domain/assistantInfo";
import { ACCOUNT_TEXT } from "./domain/account";
import type { AccountControls } from "./state/useAccount";
import { useAccountJumps } from "./state/useAccountJumps";
import { useAssistantInfo } from "./state/useAssistantInfo";
import { useBlend } from "./state/useBlend";
import { useCardActions } from "./state/useCardActions";
import { useCatalog } from "./state/useCatalog";
import { useLookedUpVideos } from "./state/useLookedUpVideos";
import { useSentShares } from "./state/useSentShares";
import { unknownVideoIds } from "./domain/sending";
import { useDemoFeedsOffer } from "./state/useDemoFeedsOffer";
import { useComposeInput } from "./state/useComposeInput";
import { useClaudeBar } from "./state/useClaudeBar";
import { useEditMode } from "./state/useEditMode";
import { useLibrary } from "./state/useLibrary";
import { useMirror } from "./state/useMirror";
import { usePersist } from "./state/usePersist";
import { useRefresh } from "./state/useRefresh";
import { useSearch } from "./state/useSearch";
import { useNotes } from "./state/useNotes";
import { useQuestionCard } from "./state/useQuestionCard";
import { sectionControl, useSections } from "./state/useSections";
import { useSession } from "./state/useSession";
import { useSessionEnd } from "./state/useSessionEnd";
import { useSharedWithYou } from "./state/useSharedWithYou";
import { ACCOUNT_SEED, DEMO_SEED } from "./state/seed";
import { useStoredHistory } from "./state/useStoredHistory";
import { useShareToggle } from "./state/useShareToggle";
import { useTabs } from "./state/useTabs";
import { useTopicSearch } from "./state/useTopicSearch";

type Props = Readonly<{
  loadCatalog: SourceCatalogLoader;
  /** The browser's storage in demo mode, the server's when signed in. */
  storage: StateStorage;
  assistant: AssistantPort;
  account: AccountControls;
  /** A save to the server that failed, with a way to send it again; null when there's none. */
  saveProblem: Readonly<{ retry: () => void }> | null;
  /** The browser's demo feeds, which a new signed-in account is offered once; null in demo mode. */
  demoFeeds: readonly Feed[] | null;
  /** Real share and send when signed in (ADR 0013); null in demo mode, where sending is simulated. */
  sharing: SharingPort | null;
  /** Topic searches for feeds' topics outside subscriptions when signed in (ADR 0011); null in demo mode. */
  searchTopics: TopicSearchPort | null;
}>;

const NO_VIDEOS: readonly Video[] = [];
const NO_CHANNEL_TOPICS: ChannelTopics = {};
const SHARE_PANEL_ID = "share-panel";

const PINNED_REASON: Reason = { kind: "pinned" };

/** Composition's reasons plus the pinned videos', which the visitor added themselves. */
const withPinnedReasons = (pinned: readonly string[], reasons: ReadonlyMap<string, Reason> = new Map()): ReadonlyMap<string, Reason> =>
  new Map([...reasons, ...pinned.map((id) => [id, PINNED_REASON] as const)]);

const reasonOf = (reasons: ReadonlyMap<string, Reason>, id: string): string => reasonText(reasons.get(id) ?? CATALOG_REASON);

export default function App({ loadCatalog, storage, assistant, account, saveProblem, demoFeeds, sharing, searchTopics }: Props) {
  // Signed in, the catalog is your YouTube (ADR 0011): channels can take your topic, and the clickbait filters are demo-only.
  const realCatalog = account.status?.kind === "signedIn";
  const [history, dispatch] = useStoredHistory(storage, realCatalog ? ACCOUNT_SEED : DEMO_SEED);
  const state = history.present;
  const passedOver = useSessionEnd(dispatch);
  usePersist(storage, state);
  const [catalog, retry] = useCatalog(loadCatalog);

  const feed = currentFeedOf(state);
  const loaded = catalog.status === "ready" ? catalog.catalog : null;
  // Channel topics are for your YouTube only; the demo catalog's topics are fixed.
  const channelTopics = realCatalog ? state.channelTopics : NO_CHANNEL_TOPICS;
  const ownCatalog = useMemo(() => loaded && withChannelTopics(loaded, channelTopics), [loaded, channelTopics]);
  // Topics the feeds name that are thin in your own catalog bring in shared topic searches; they're found as that topic.
  const topicSearch = useTopicSearch(searchTopics, ownCatalog, state.feeds);
  // Signed in, the channels of your own catalog are your YouTube subscriptions, so you follow them (topic searches' aren't).
  const subscribed = useMemo(() => (realCatalog && ownCatalog ? subscribedChannels(ownCatalog) : NO_SUBSCRIPTIONS), [realCatalog, ownCatalog]);
  const ready = useMemo(() => ownCatalog && withFoundVideos(ownCatalog, topicSearch.videos), [ownCatalog, topicSearch.videos]);
  const catalogById = useMemo(() => new Map((ready ?? []).map((v) => [v.id, v])), [ready]);
  const unknownIds = useMemo(() => (ready && sharing ? unknownVideoIds(state, catalogById) : []), [ready, sharing, state, catalogById]);
  const lookedUp = useLookedUpVideos(sharing, unknownIds);
  const byId = useMemo(
    () => new Map([...withChannelTopics([...lookedUp.videos.values()], channelTopics).map((v) => [v.id, v] as const), ...catalogById]),
    [lookedUp.videos, channelTopics, catalogById],
  );
  const input = useComposeInput(state, feed, ready, byId, subscribed);
  const composed = useMemo(() => input && composeFeed(input), [input]);
  const session = useSession(feed, byId, dispatch);
  const sessionVideos = session.current ? [...session.finished, session.current] : session.finished;
  const notes = useNotes({ feed, videos: sessionVideos, notes: state.notes, assistant, dispatch, showFlash: session.showFlash });
  const library = useLibrary(state, feed, byId, dispatch);
  const cardActions = useCardActions({ state, feed, catalog: ready ?? NO_VIDEOS, realCatalog, subscribed, dispatch });
  const pinned = feed.pinned.flatMap((id) => byId.get(id) ?? []);
  const { refresh, undo } = useRefresh(input, dispatch);
  const tabs = useTabs(state, feed, dispatch);
  const shared = useSharedWithYou({ state, feed, catalog: ready, lookup: lookedUp.lookup, byId, dispatch, openFeed: tabs.open });
  useSentShares({ sharing, cursor: state.inbox.sentCursor, looking: feed.kind === "shared", dispatch });
  const composition = feed.kind === "shared" ? shared.composition : composed;
  const shareToggle = useShareToggle(feed.name);
  const shareVideos = shareStartingVideos(sessionVideos, pinned, composition?.upNext ?? NO_VIDEOS);
  // With nothing to share the panel has nothing to show, so the button never claims it's open.
  const share = { ...shareToggle, open: shareToggle.open && shareVideos.length > 0 && !shared.inInbox };
  const upNext = [...pinned, ...(composition?.upNext ?? [])];
  const reasons = useMemo(() => withPinnedReasons(feed.pinned, composition?.reasons), [feed.pinned, composition]);
  const firstReason = upNext.length > 0 ? reasonOf(reasons, upNext[0].id) : null;
  useEffect(() => {
    passedOver.current = hasSessionStarted(feed) && composition ? { feed: feed.name, videos: composition.upNext.map((v) => v.id) } : null;
  }, [passedOver, feed, composition]);
  const questions = useQuestionCard({ feed, scope: `${tabs.page}:${feed.name}`, byId, dispatch });
  const claudeBar = useClaudeBar({
    assistant,
    feeds: state.feeds,
    feed,
    upNext,
    firstReason,
    catalog: ready ?? NO_VIDEOS,
    questions,
    chosenMode: state.barMode,
    dispatch,
  });
  const mirror = useMirror({ feed, byId, now: input?.now ?? null, dispatch });
  const edit = useEditMode(state.feeds, dispatch);
  const blend = useBlend({ feeds: state.feeds, feed, catalog: ready ?? NO_VIDEOS, sharing, dispatch });
  const info = useAssistantInfo(assistant);
  const demoOffer = useDemoFeedsOffer({ demoFeeds, offered: state.demoFeedsOffered, catalog: ready, dispatch });
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
      {saveProblem && <CatalogError message={ACCOUNT_TEXT.saveFailed} retryLabel={ACCOUNT_TEXT.retrySave} onRetry={saveProblem.retry} />}
      <Flash message={account.flash ?? tabs.flash ?? search.flash ?? shared.flash ?? topicSearch.flash} />
      <main>
        {demoOffer && <DemoFeedsOfferCard offer={demoOffer} />}
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
            <RecipeLog feedName={feed.name} log={feed.log} onClear={() => dispatch({ type: "clear_log", feed: feed.name })} />
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
                    realCatalog={realCatalog}
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
                {catalog.status === "error" && (
                  <CatalogError message={catalog.message} onRetry={retry}>
                    {account.status?.kind === "signedIn" && (
                      <button type="button" onClick={account.signOut} disabled={account.busy}>
                        Sign out
                      </button>
                    )}
                  </CatalogError>
                )}
                <MirrorCard mirror={mirror} />
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
                    sharing={sharing}
                    onClose={share.close}
                  />
                )}
                {composition && (
                  <FeedView
                    // Switching layouts or loading a new set starts with every description closed, as in the mockup.
                    key={`${state.view}-${feed.seed}`}
                    pinned={pinned}
                    upNext={composition.upNext}
                    reasons={reasons}
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
      <Footer onReset={realCatalog ? null : () => dispatch({ type: "reset" })} />
    </div>
  );
}
