import { useEffect, useRef } from "react";
import { BROKEN_LINK, shareFromLink, type InboxShare } from "../domain/inbox";
import { decodeShare, readShareFragment } from "../domain/share";
import type { Video } from "../domain/types";

type Options = Readonly<{
  /** Null until the catalog loads: a link can only be checked against it. */
  catalog: readonly Video[] | null;
  onReceive: (share: InboxShare) => void;
  onBroken: (message: string) => void;
}>;

/** Drops the fragment from the address bar without adding a history entry, so a reload doesn't open the link again. */
const clearFragment = () => window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);

/**
 * Opens `#share=` links: on load (once the catalog is in) and whenever the fragment changes.
 * A link is untrusted (ADR 0008): it must decode within the limits and name only catalog videos.
 */
export function useShareLinks({ catalog, onReceive, onBroken }: Options): void {
  const handlers = useRef({ onReceive, onBroken });
  useEffect(() => {
    handlers.current = { onReceive, onBroken };
  });

  useEffect(() => {
    if (!catalog) return;
    const ids = new Set(catalog.map((v) => v.id));
    const openLink = () => {
      const encoded = readShareFragment(window.location.hash);
      if (encoded === null) return;
      clearFragment();
      const decoded = decodeShare(encoded);
      const share = decoded && shareFromLink(decoded, ids, Date.now());
      if (share) handlers.current.onReceive(share);
      else handlers.current.onBroken(BROKEN_LINK);
    };
    openLink();
    window.addEventListener("hashchange", openLink);
    return () => window.removeEventListener("hashchange", openLink);
  }, [catalog]);
}
