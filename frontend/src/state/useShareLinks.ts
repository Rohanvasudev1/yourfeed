import { useEffect, useRef } from "react";
import { BROKEN_LINK, LOOKUP_FAILED, shareFromLink, type InboxShare } from "../domain/inbox";
import { decodeShare, readShareFragment, type Share } from "../domain/share";
import type { Video } from "../domain/types";

type Options = Readonly<{
  /** Null until the catalog loads: a link can only be checked against it. */
  catalog: readonly Video[] | null;
  /** Signed in, finds videos outside the catalog (ADR 0013); null in demo mode, where a link names only catalog videos. */
  lookup: ((ids: readonly string[]) => Promise<readonly Video[]>) | null;
  onReceive: (share: InboxShare) => void;
  onBroken: (message: string) => void;
}>;

/** Drops the fragment from the address bar without adding a history entry, so a reload doesn't open the link again. */
const clearFragment = () => window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);

/** The ids the link may name: the catalog's, plus any of its own videos found by `lookup`. */
async function knownIds(share: Share, catalogIds: ReadonlySet<string>, lookup: Options["lookup"]): Promise<ReadonlySet<string>> {
  const missing = share.videos.filter((id) => !catalogIds.has(id));
  if (missing.length === 0 || !lookup) return catalogIds;
  const found = await lookup(missing);
  return new Set([...catalogIds, ...found.map((v) => v.id)]);
}

/**
 * Opens `#share=` links: on load (once the catalog is in) and whenever the fragment changes.
 * A link is untrusted (ADR 0008): it must decode within the limits and name only videos the catalog has or, signed in, YouTube has.
 */
export function useShareLinks({ catalog, lookup, onReceive, onBroken }: Options): void {
  const handlers = useRef({ lookup, onReceive, onBroken });
  useEffect(() => {
    handlers.current = { lookup, onReceive, onBroken };
  });

  useEffect(() => {
    if (!catalog) return;
    const ids = new Set(catalog.map((v) => v.id));
    const openLink = async () => {
      const encoded = readShareFragment(window.location.hash);
      if (encoded === null) return;
      clearFragment();
      const decoded = decodeShare(encoded);
      if (!decoded) return handlers.current.onBroken(BROKEN_LINK);
      const known = await knownIds(decoded, ids, handlers.current.lookup);
      const share = shareFromLink(decoded, known, Date.now());
      if (share) handlers.current.onReceive(share);
      else handlers.current.onBroken(BROKEN_LINK);
    };
    const open = () =>
      openLink().catch((err: unknown) => {
        console.error("Couldn't look up a share link's videos", err);
        handlers.current.onBroken(LOOKUP_FAILED);
      });
    void open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [catalog]);
}
