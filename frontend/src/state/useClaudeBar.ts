import { useState, type Dispatch } from "react";
import { barModeFor, changesFeed, feedContext, MAX_REQUEST_CHARS, type AssistantResult } from "../domain/assistant";
import type { Feed, Video } from "../domain/types";
import type { AssistantPort } from "../ports";
import type { Action } from "./appState";
import { useTimedValue } from "./useTimedValue";

const REPLY_MS = 5000;
export const EMPTY_REQUEST = "Type something first";
export const TOO_LONG = `Keep requests under ${MAX_REQUEST_CHARS} characters`;
export const UNREACHABLE = "Couldn't reach Claude. Try again.";
export const ALREADY = "Already in this feed.";

type Input = Readonly<{ assistant: AssistantPort; feed: Feed; upNext: readonly Video[]; dispatch: Dispatch<Action> }>;

/** The Claude bar: what's typed, whether the assistant is thinking, and its last reply or error. */
export function useClaudeBar({ assistant, feed, upNext, dispatch }: Input) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [reply, showReply] = useTimedValue<string>(REPLY_MS);

  /** Applies the answer to the feed that asked, which may no longer be open. */
  const settle = (asked: Feed, result: AssistantResult) => {
    const edits = barModeFor(asked) === "edit" && changesFeed(asked, result.actions);
    if (edits) dispatch({ type: "apply_request", feed: asked.name, actions: result.actions });
    const message = result.reply ?? (edits ? null : ALREADY);
    if (message) showReply(message);
  };

  const send = async () => {
    const request = text.trim();
    if (thinking) return;
    if (!request) return setError(EMPTY_REQUEST);
    if (request.length > MAX_REQUEST_CHARS) return setError(TOO_LONG);
    setError(null);
    setThinking(true);
    const asked = feed;
    try {
      settle(asked, await assistant.request(request, barModeFor(asked), feedContext(asked, upNext)));
      setText("");
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
