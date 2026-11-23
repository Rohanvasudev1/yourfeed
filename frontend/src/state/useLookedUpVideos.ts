import { useCallback, useEffect, useRef, useState } from "react";
import { lookupBatches } from "../domain/sending";
import type { Video } from "../domain/types";
import type { SharingPort } from "../ports";

export type LookedUpVideos = Readonly<{
  /** Videos found outside the catalog this visit, by id. Not saved: they're looked up again next visit (ADR 0011). */
  videos: ReadonlyMap<string, Video>;
  /** Looks up ids not asked for yet this visit and returns every one of `ids` that's known now. Null in demo mode. */
  lookup: ((ids: readonly string[]) => Promise<readonly Video[]>) | null;
}>;

const NONE: ReadonlyMap<string, Video> = new Map();

/** Signed in, finds videos outside the catalog on YouTube (ADR 0013): `wanted` at once, and others when asked. Each id is asked for once a visit. */
export function useLookedUpVideos(sharing: SharingPort | null, wanted: readonly string[]): LookedUpVideos {
  const [videos, setVideos] = useState<ReadonlyMap<string, Video>>(NONE);
  const found = useRef<ReadonlyMap<string, Video>>(NONE);
  const asked = useRef<ReadonlySet<string>>(new Set());

  const lookup = useCallback(
    async (ids: readonly string[]): Promise<readonly Video[]> => {
      if (!sharing) return [];
      const fresh = ids.filter((id) => !asked.current.has(id));
      asked.current = new Set([...asked.current, ...fresh]);
      const batches = await Promise.all(lookupBatches(fresh).map((batch) => sharing.lookupVideos(batch)));
      const added = batches.flat();
      if (added.length > 0) {
        found.current = new Map([...found.current, ...added.map((v) => [v.id, v] as const)]);
        setVideos(found.current);
      }
      return ids.flatMap((id) => found.current.get(id) ?? []);
    },
    [sharing],
  );

  const wantedKey = wanted.join(",");
  useEffect(() => {
    if (!sharing || !wantedKey) return;
    lookup(wantedKey.split(",")).catch((err: unknown) => console.error("Couldn't look up shared videos", err));
  }, [sharing, wantedKey, lookup]);

  return { videos, lookup: sharing ? lookup : null };
}
