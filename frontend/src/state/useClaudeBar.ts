import { useEffect, useRef, useState, type Dispatch } from "react";
import { barModeFor, changesFeed, feedContext, MAX_REQUEST_CHARS, type AssistantResult } from "../domain/assistant";
import { awaitsConnection } from "../domain/fromClaude";
import type { Feed, Video } from "../domain/types";
import type { AssistantPort } from "../ports";
import type { Action } from "./appState";
import { useTimedValue } from "./useTimedValue";

const REPLY_MS = 5000;
const EMPTY_REQUEST = "Type something first";
const TOO_LONG = `Keep requests under ${MAX_REQUEST_CHARS} characters`;
const UNREACHABLE = "Couldn't reach Claude. Try again.";
const ALREADY = "Already in this feed.";
const CONNECT_FIRST = "Connect Claude first, then tell me what to add.";

type Input = Readonly<{
  assistant: AssistantPort;
  /** Every feed, so an answer is checked against the asking feed as it is when the answer lands. */
  feeds: readonly Feed[];
  feed: Feed;
  upNext: readonly Video[];
  dispatch: Dispatch<Action>;
}>;

/** The Claude bar: what's typed, whether the assistant is thinking, and its last reply or error. */
export function useClaudeBar({ assistant, feeds, feed, upNext, dispatch }: Input) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [reply, showReply] = useTimedValue<string>(REPLY_MS);
  const latestFeeds = useRef(feeds);
  useEffect(() => {
    latestFeeds.current = feeds;
  }, [feeds]);

  /** Applies the answer to the feed that asked, which may no longer be open and may have changed meanwhile. */
  const settle = (askedName: string, result: AssistantResult) => {
    const asked = latestFeeds.current.find((f) => f.name === askedName);
    if (!asked) return;
    const shouldApply = barModeFor(asked) === "edit" && changesFeed(asked, result.actions);
    if (shouldApply) dispatch({ type: "apply_request", feed: asked.name, actions: result.actions });
    const message = result.reply ?? (shouldApply ? null : ALREADY);
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
    const asked = feed;
    try {
      settle(asked.name, await assistant.request(request, barModeFor(asked), feedContext(asked, upNext)));
      if (suggestion === undefined) setText("");
    } catch (err) {
      console.error("Claude bar request failed", err);
      setError(UNREACHABLE);
    } finally {
      setThinking(false);
    }
  };

  return { text, setText, error, thinking, reply, send };
}

export type ClaudeBarState = ReturnType<typeof useClaudeBar>;
