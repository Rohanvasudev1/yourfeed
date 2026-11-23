import { useEffect, useMemo, useRef, useState } from "react";
import { searchBatches, thinTopics, TOPIC_SEARCH_TEXT } from "../domain/topicSearch";
import type { Feed, Video } from "../domain/types";
import type { TopicSearchPort } from "../ports";
import { FLASH_MS, useTimedValue } from "./useTimedValue";

export type TopicSearch = Readonly<{
  /** Videos topic searches found this visit. Not saved: the server caches searches (ADR 0011). */
  videos: readonly Video[];
  /** Says once a visit that today's searches are used up. */
  flash: string | null;
}>;

const NONE: readonly Video[] = [];
const SEPARATOR = "\n";

/** Signed in, searches each thin topic the feeds name once a visit, as feeds gain topics. Null `search` in demo mode. */
export function useTopicSearch(search: TopicSearchPort | null, catalog: readonly Video[] | null, feeds: readonly Feed[]): TopicSearch {
  const [videos, setVideos] = useState<readonly Video[]>(NONE);
  const [flash, showFlash] = useTimedValue<string>(FLASH_MS);
  const asked = useRef<ReadonlySet<string>>(new Set());
  const toldPaused = useRef(false);
  // Joined into one string so the effect runs when the thin topics change, not whenever the feeds do.
  const wanted = useMemo(() => (search && catalog ? thinTopics(feeds, catalog).join(SEPARATOR) : ""), [search, catalog, feeds]);

  useEffect(() => {
    if (!search || !wanted) return;
    const fresh = wanted.split(SEPARATOR).filter((t) => !asked.current.has(t));
    if (fresh.length === 0) return;
    asked.current = new Set([...asked.current, ...fresh]);
    for (const batch of searchBatches(fresh)) {
      search(batch)
        .then((answer) => {
          if (answer.videos.length > 0) setVideos((had) => [...had, ...answer.videos.filter((v) => !had.some((h) => h.id === v.id))]);
          if (answer.paused && !toldPaused.current) {
            toldPaused.current = true;
            showFlash(TOPIC_SEARCH_TEXT.paused);
          }
        })
        .catch((err: unknown) => {
          // Quietly: the feed still has the catalog's videos, and a later change asks again.
          console.error("Topic search failed", err);
          asked.current = new Set([...asked.current].filter((t) => !batch.includes(t)));
        });
    }
  }, [search, wanted, showFlash]);

  return { videos: search ? videos : NONE, flash };
}
