import { useMemo, useState, type Dispatch } from "react";
import { applyFeedActions } from "../domain/assistant";
import { resolveBehaviour } from "../domain/behaviour";
import { mirror, type Proposal } from "../domain/mirror";
import { newLine, summarizeChange } from "../domain/recipeLog";
import type { Feed, Video } from "../domain/types";
import type { Action } from "./appState";

/** What one visit remembers per feed: the one proposal it showed, and whether the visitor answered it. */
type Shown = Readonly<{ id: string; answered: boolean }>;

type Input = Readonly<{
  feed: Feed;
  byId: ReadonlyMap<string, Video>;
  /** This visit's clock reading, the one composition uses; null until the catalog is ready. */
  now: number | null;
  dispatch: Dispatch<Action>;
}>;

/** The recipe log's request for an accepted proposal. */
export const acceptedRequest = (proposal: Proposal): string => `Recipe mirror: ${proposal.accept}`;

/**
 * The recipe mirror's card for the open feed: at most one proposal per feed per visit. Once a feed
 * has shown one, no other shows on it this visit, and once it's accepted or dismissed none does.
 */
export function useMirror({ feed, byId, now, dispatch }: Input) {
  const [shown, setShown] = useState<ReadonlyMap<string, Shown>>(new Map());
  const found = useMemo(() => (now === null ? null : mirror(feed, resolveBehaviour(feed.behaviour, byId), now)), [feed, byId, now]);
  const seen = shown.get(feed.name);
  const proposal = found && (!seen || (seen.id === found.id && !seen.answered)) ? found : null;
  // Remember what this visit showed while rendering it, so a later, different proposal can't replace it.
  if (proposal && !seen) setShown(new Map([...shown, [feed.name, { id: proposal.id, answered: false }]]));

  const answer = (p: Proposal) => setShown((m) => new Map([...m, [feed.name, { id: p.id, answered: true }]]));

  return {
    proposal,
    /** Applies the proposal the way a Claude bar request is applied: one undo step and a recipe log line. */
    accept: (p: Proposal) => {
      const line = newLine(acceptedRequest(p), summarizeChange(feed, applyFeedActions(feed, p.actions)));
      dispatch({ type: "apply_request", feed: feed.name, actions: p.actions, line });
      answer(p);
    },
    dismiss: (p: Proposal) => {
      dispatch({ type: "dismiss_proposal", feed: feed.name, proposal: p.id, at: Date.now() });
      answer(p);
    },
  };
}

export type MirrorState = ReturnType<typeof useMirror>;
