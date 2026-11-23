import { useMemo, useState } from "react";
import { behaviourFor } from "../domain/behaviour";
import { myTopics } from "../domain/blend";
import { TOP_RANGE_HOURS } from "../domain/feed";
import type { ComposeInput, Feed, Video } from "../domain/types";
import type { AppState } from "./appState";

/** What composition reads for the open feed, once the catalog is ready; null until then. */
export function useComposeInput(state: AppState, feed: Feed, catalog: readonly Video[] | null, byId: ReadonlyMap<string, Video>) {
  // One clock reading per visit, so Up next doesn't reorder as time passes; only what the visitor does moves it.
  const [now] = useState(() => Date.now());
  const mine = useMemo(() => myTopics(state.feeds), [state.feeds]);
  const behaviour = useMemo(() => behaviourFor(feed, state.feeds, byId), [feed, state.feeds, byId]);
  const following = useMemo(() => state.feeds.find((f) => f.kind === "subs")?.channels ?? [], [state.feeds]);
  return useMemo<ComposeInput | null>(
    () =>
      catalog && {
        catalog,
        feed,
        filters: state.filters,
        watched: state.watched,
        topMaxAgeHours: TOP_RANGE_HOURS[feed.topRange],
        myTopics: mine,
        behaviour,
        now,
        following,
      },
    [catalog, feed, state.filters, state.watched, mine, behaviour, now, following],
  );
}
