import { useMemo, type Dispatch } from "react";
import { myTopics, tasteOf } from "../domain/blend";
import type { Feed, Video } from "../domain/types";
import type { HistoryAction } from "./history";

/** What the Blend panel can do to the open Blend feed. Other people are simulated (ADR 0008). */
export function useBlend(feeds: readonly Feed[], feed: Feed, catalog: readonly Video[], dispatch: Dispatch<HistoryAction>) {
  const catalogTopics = useMemo(() => [...new Set(catalog.map((v) => v.topic))], [catalog]);
  return {
    invite: (name: string) => dispatch({ type: "invite_blend", feed: feed.name, partner: tasteOf(name, myTopics(feeds), catalogTopics) }),
    clear: () => dispatch({ type: "clear_blend", feed: feed.name }),
    approve: () => dispatch({ type: "approve_blend", feed: feed.name }),
    open: (name: string) => dispatch({ type: "open_blend", feed: feed.name, name }),
    forget: (name: string) => dispatch({ type: "forget_blend", feed: feed.name, name }),
  };
}

export type BlendControls = ReturnType<typeof useBlend>;
