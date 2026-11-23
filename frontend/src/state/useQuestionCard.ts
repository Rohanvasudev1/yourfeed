import { useState, type Dispatch } from "react";
import { applyFeedActions, type FeedAction } from "../domain/assistant";
import { cardForAnswer, PICK_FIRST, togglePick, topicsToAdd, type QuestionCard } from "../domain/questionCard";
import { newLine, summarizeChange } from "../domain/recipeLog";
import type { Feed, Video } from "../domain/types";
import type { Action } from "./appState";

/** The feedback card's two answers, as its buttons name them. */
export const FEEDBACK_GOOD = "Looks good";
export const FEEDBACK_BAD = "Not quite";

type Input = Readonly<{
  feed: Feed;
  /** Where the visitor is (page and feed). Any change closes the card. */
  scope: string;
  byId: ReadonlyMap<string, Video>;
  dispatch: Dispatch<Action>;
}>;

/** The open question card, if any, and what its buttons do. It lives only until the visitor moves on. */
export function useQuestionCard({ feed, scope, byId, dispatch }: Input) {
  const [card, setCard] = useState<QuestionCard | null>(null);
  const [cardScope, setCardScope] = useState(scope);
  // Changing tabs or pages closes the card, so an old question never comes back.
  if (scope !== cardScope) {
    setCardScope(scope);
    setCard(null);
  }
  // An answer for a feed the visitor has since left is never shown.
  const open = card?.feed === feed.name ? card : null;

  /** An answer is one undo step and one recipe log line, like a request: the question and the answer given. */
  const applyAnswer = (question: QuestionCard, answer: string, actions: readonly FeedAction[]) =>
    dispatch({
      type: "apply_request",
      feed: feed.name,
      actions,
      line: newLine(`${question.question} ${answer}`, summarizeChange(feed, applyFeedActions(feed, actions))),
    });

  return {
    card: open,
    close: () => setCard(null),
    /** Opens the card an answer asks for; says whether it opened one. */
    answer: (asked: Feed, actions: readonly FeedAction[], applied: boolean): boolean => {
      const next = cardForAnswer(asked, actions, applied);
      setCard(next);
      return next !== null;
    },
    toggle: (item: string) => setCard((c) => c && togglePick(c, item)),
    addSelected: () => {
      if (!open) return;
      if (open.picked.length === 0) return setCard({ ...open, error: PICK_FIRST });
      const change = { type: "set_topics", add: topicsToAdd(open, byId), remove: [] } as const;
      applyAnswer(open, open.kind === "videos" ? change.add.join(", ") : open.picked.join(", "), [change]);
      setCard(cardForAnswer(feed, [change], true));
    },
    feedback: (good: boolean) => {
      if (open) applyAnswer(open, good ? FEEDBACK_GOOD : FEEDBACK_BAD, good ? [] : [{ type: "set_topics", add: [], remove: open.items }]);
      setCard(null);
    },
  };
}

export type QuestionCardState = ReturnType<typeof useQuestionCard>;
