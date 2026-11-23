import { useCallback, useEffect, useRef, useState } from "react";
import { lookupBatches } from "../domain/sending";
import type { Video } from "../domain/types";
import type { SharingPort } from "../ports";

export type LookedUpVideos = Readonly<{
  /** Videos found outside the catalog this visit, by id. Not saved: they're looked up again next visit (ADR 0011). */
  videos: ReadonlyMap<string, Video>;
  /** Looks up `ids` (each at most once a visit, waiting for one already asked for) and returns those YouTube has. Null in demo mode. */
  lookup: ((ids: readonly string[]) => Promise<readonly Video[]>) | null;
}>;

const NONE: ReadonlyMap<string, Video> = new Map();

/** Signed in, finds videos outside the catalog on YouTube (ADR 0013): `wanted` at once, and others when asked. */
export function useLookedUpVideos(sharing: SharingPort | null, wanted: readonly string[]): LookedUpVideos {
  const [videos, setVideos] = useState<ReadonlyMap<string, Video>>(NONE);
  const found = useRef<ReadonlyMap<string, Video>>(NONE);
  // Each asked-for id's request, so a second ask waits for the first instead of finding nothing yet.
  const asked = useRef<ReadonlyMap<string, Promise<unknown>>>(new Map());

  const fetchBatch = useCallback(
    async (port: SharingPort, batch: readonly string[]) => {
      try {
        const added = await port.lookupVideos(batch);
        if (added.length === 0) return;
        found.current = new Map([...found.current, ...added.map((v) => [v.id, v] as const)]);
        setVideos(found.current);
      } catch (err: unknown) {
        // A failed lookup may be tried again later in the visit.
        asked.current = new Map([...asked.current].filter(([id]) => !batch.includes(id)));
        throw err;
      }
    },
    [],
  );

  const lookup = useCallback(
    async (ids: readonly string[]): Promise<readonly Video[]> => {
      if (!sharing) return [];
      const fresh = [...new Set(ids)].filter((id) => !asked.current.has(id));
      const requests = lookupBatches(fresh).map((batch) => [batch, fetchBatch(sharing, batch)] as const);
      asked.current = new Map([...asked.current, ...requests.flatMap(([batch, request]) => batch.map((id) => [id, request] as const))]);
      await Promise.all(ids.map((id) => asked.current.get(id)));
      return ids.flatMap((id) => found.current.get(id) ?? []);
    },
    [sharing, fetchBatch],
  );

  const wantedKey = wanted.join(",");
  useEffect(() => {
    if (!sharing || !wantedKey) return;
    lookup(wantedKey.split(",")).catch((err: unknown) => console.error("Couldn't look up shared videos", err));
  }, [sharing, wantedKey, lookup]);

  return { videos, lookup: sharing ? lookup : null };
}
