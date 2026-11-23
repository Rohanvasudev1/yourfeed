import { useMemo, useReducer } from "react";
import { composeFeed } from "../domain/compose";
import { CATALOG_REASON, reasonText } from "../domain/rank";
import { SHOWCASE_FEED, showcaseBehaviour } from "../domain/showcase";
import type { Video } from "../domain/types";
import type { AssistantPort } from "../ports";
import { currentFeedOf, makeReducer, type AppState } from "./appState";
import { startHistory, withHistory } from "./history";
import { DEMO_SEED } from "./seed";
import { useCardActions } from "./useCardActions";
import { useClaudeBar } from "./useClaudeBar";
import { useComposeInput } from "./useComposeInput";
import { useLibrary } from "./useLibrary";
import { useMirror } from "./useMirror";
import { useQuestionCard } from "./useQuestionCard";
import { useSession } from "./useSession";

/** How many Up next cards the showcase shows: enough to reach the outside-your-recipe slot, the third. */
export const SHOWCASE_CARDS = 3;

const reducer = withHistory(makeReducer(DEMO_SEED));

/** The demo's state with its Learn feed open, carrying removals the recipe mirror will notice. */
function showcaseState(catalog: readonly Video[]): AppState {
  const now = Date.now();
  const feeds = DEMO_SEED.feeds.map((f) => (f.name === SHOWCASE_FEED ? { ...f, behaviour: [...f.behaviour, ...showcaseBehaviour(f, catalog, now)] } : f));
  return { ...DEMO_SEED, feeds, currentFeed: SHOWCASE_FEED };
}

type Input = Readonly<{ catalog: readonly Video[]; assistant: AssistantPort }>;

/**
 * The showcase's live demo: a fresh copy of the demo state, kept only in memory so it never touches the
 * visitor's own feeds, driven by the same reducer and hooks as the app.
 */
export function useShowcase({ catalog, assistant }: Input) {
  const [history, dispatch] = useReducer(reducer, catalog, (c) => startHistory(showcaseState(c)));
  const state = history.present;
  const feed = currentFeedOf(state);
  const byId = useMemo(() => new Map(catalog.map((v) => [v.id, v])), [catalog]);
  const input = useComposeInput(state, feed, catalog, byId);
  const composition = useMemo(() => input && composeFeed(input), [input]);
  const upNext = composition?.upNext ?? [];
  const reasons = composition?.reasons ?? new Map();
  const questions = useQuestionCard({ feed, scope: feed.name, byId, dispatch });
  const claudeBar = useClaudeBar({
    assistant,
    feeds: state.feeds,
    feed,
    upNext,
    firstReason: upNext.length > 0 ? reasonText(reasons.get(upNext[0].id) ?? CATALOG_REASON) : null,
    catalog,
    questions,
    chosenMode: state.barMode,
    dispatch,
  });
  const mirror = useMirror({ feed, byId, now: input?.now ?? null, dispatch });
  const session = useSession(feed, byId, dispatch);
  const library = useLibrary(state, feed, byId, dispatch);
  const cardActions = useCardActions({ state, feed, catalog, realCatalog: false, dispatch });

  return {
    state,
    feed,
    byId,
    history,
    dispatch,
    claudeBar,
    questions,
    mirror,
    cards: upNext.slice(0, SHOWCASE_CARDS),
    reasons,
    play: session.play,
    flash: session.flash,
    saveActions: library.saveActions,
    cardActions,
  };
}

export type ShowcaseState = ReturnType<typeof useShowcase>;
