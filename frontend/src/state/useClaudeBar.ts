import { useEffect, useRef, useState, type Dispatch } from "react";
import { applyFeedActions, barModeFor, changesFeed, feedContext, MAX_REQUEST_CHARS, type AssistantResult, type BarMode, type FeedAction, isLockedToNew } from "../domain/assistant";
import { awaitsConnection } from "../domain/fromClaude";
import { createFromRequest } from "../domain/newFeed";
import { exploreVideos } from "../domain/questionCard";
import { followUpsOf, newLine, NO_CHANGE, summarizeChange, summarizeNew } from "../domain/recipeLog";
import type { Feed, Video } from "../domain/types";
import type { AssistantPort } from "../ports";
import type { Action } from "./appState";
import type { QuestionCardState } from "./useQuestionCard";
import { useTimedValue } from "./useTimedValue";

const REPLY_MS = 5000;
const EMPTY_REQUEST = "Type something first";
const TOO_LONG = `Keep requests under ${MAX_REQUEST_CHARS} characters`;
const UNREACHABLE = "Couldn't reach Claude. Try again.";
const ALREADY = "Already in this feed.";
const CONNECT_FIRST = "Connect Claude first, then tell me what to add.";
const NOTHING_TO_START = "Name a topic to start a new feed.";
const shelvedNotice = (name: string) => `The tab bar is full, so ${name} is in All tabs.`;

/** A request's recipe log summary: what it changed, else the question it asked back, else "no change". */
function summaryOf(feed: Feed, actions: readonly FeedAction[]): string {
  const changed = summarizeChange(feed, applyFeedActions(feed, actions));
  const asked = actions.find((a) => a.type === "ask_user");
  return changed === NO_CHANGE && asked ? `asked ${asked.question}` : changed;
}

type Input = Readonly<{
  assistant: AssistantPort;
  /** Every feed, so an answer is checked against the asking feed as it is when the answer lands. */
  feeds: readonly Feed[];
  feed: Feed;
  upNext: readonly Video[];
  /** The reason the first Up next card shows. */
  firstReason: string | null;
  /** The whole catalog, for videos from topics the feed doesn't have. */
  catalog: readonly Video[];
  questions: Pick<QuestionCardState, "answer" | "close">;
  /** The mode the visitor chose for their own feeds. */
  chosenMode: BarMode;
  dispatch: Dispatch<Action>;
}>;

/** The Claude bar: its mode, what's typed, whether the assistant is thinking, and its last reply or error. */
export function useClaudeBar({ assistant, feeds, feed, upNext, firstReason, catalog, questions, chosenMode, dispatch }: Input) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [reply, showReply] = useTimedValue<string>(REPLY_MS);
  const [busyNotice, setBusyNotice] = useState<string | null>(null);
  const busyNoticeShown = useRef(false);
  const latestFeeds = useRef(feeds);
  useEffect(() => {
    latestFeeds.current = feeds;
  }, [feeds]);

  const mode = barModeFor(feed, chosenMode);

  /** The rules' notice shows once a visit: it stays while they keep answering and goes when the model is back. */
  const noteBusyNotice = (result: AssistantResult) => {
    if (!result.notice) return setBusyNotice(null);
    if (busyNoticeShown.current) return;
    busyNoticeShown.current = true;
    setBusyNotice(result.notice);
  };

  /** Makes a feed from the answer. Its name and place are worked out here the same way the reducer will. */
  const create = (request: string, asked: Feed, result: AssistantResult) => {
    const before = latestFeeds.current;
    const made = createFromRequest({ feeds: before, currentFeed: asked.name }, asked.name, result.actions);
    const created = made.feeds === before ? undefined : made.feeds.find((f) => f.name === made.currentFeed);
    if (created) dispatch({ type: "create_from_request", from: asked.name, actions: result.actions, line: newLine(request, summarizeNew(created), result.reply) });
    // A shelved feed is out of sight, so say where it went even after the assistant's own reply.
    const notice = created ? (created.shelved ? shelvedNotice(created.name) : null) : NOTHING_TO_START;
    const message = created ? [result.reply, notice].filter(Boolean).join(" ") : (result.reply ?? notice);
    if (message) showReply(message);
  };

  /** Applies the answer to the feed that asked, which may no longer be open and may have changed meanwhile. */
  const settle = (request: string, askedName: string, askedMode: BarMode, result: AssistantResult) => {
    const asked = latestFeeds.current.find((f) => f.name === askedName);
    if (!asked) return;
    if (askedMode === "new" || asked.draft) return create(request, asked, result);
    const shouldApply = changesFeed(asked, result.actions);
    // Every answered request gets a log line, even one that changed nothing, so a follow-up can build on it.
    const line = newLine(request, summaryOf(asked, result.actions), result.reply);
    dispatch({ type: "apply_request", feed: asked.name, actions: shouldApply ? result.actions : [], line });
    const asking = questions.answer(asked, result.actions, shouldApply);
    const message = result.reply ?? (shouldApply || asking ? null : ALREADY);
    if (message) showReply(message);
  };

  /** Sends what's typed, or `suggestion` (a From Claude chip) while leaving what's typed alone. */
  const send = async (suggestion?: string) => {
    const request = (suggestion ?? text).trim();
    if (thinking) return;
    if (!request) return setError(EMPTY_REQUEST);
    if (request.length > MAX_REQUEST_CHARS) return setError(TOO_LONG);
    setError(null);
    if (awaitsConnection(feed)) return showReply(CONNECT_FIRST);
    setThinking(true);
    dispatch({ type: "see_provider_notice" });
    questions.close();
    const asked = feed;
    const askedMode = mode;
    const context = feedContext(asked, upNext, firstReason, exploreVideos(catalog, asked, request));
    try {
      // A new feed starts from the request alone: the asking feed's log is about a different recipe.
      const followUps = askedMode === "new" || asked.draft ? [] : followUpsOf(asked.log);
      const result = await assistant.request(request, askedMode, context, followUps);
      noteBusyNotice(result);
      settle(request, asked.name, askedMode, result);
      if (suggestion === undefined) setText("");
    } catch (err) {
      console.error("Claude bar request failed", err);
      setError(UNREACHABLE);
    } finally {
      setThinking(false);
    }
  };

  return {
    text,
    setText,
    error,
    thinking,
    reply,
    busyNotice,
    send,
    mode,
    feedName: feed.name,
    /** Whether the switch is shown: a draft is always the new feed, so it has none. */
    hasSwitch: !feed.draft,
    /** Built-in feeds are always in new mode. */
    modeLocked: isLockedToNew(feed),
    setMode: (next: BarMode) => dispatch({ type: "set_bar_mode", mode: next }),
  };
}

export type ClaudeBarState = ReturnType<typeof useClaudeBar>;
