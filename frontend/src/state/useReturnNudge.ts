import { useEffect, useState } from "react";

/**
 * True once the visitor comes back to the page while `watching` (a key naming the feed and its
 * Watching now video) is on screen, so the Finished button can ask whether they're done. The
 * nudge belongs to that key: another feed or another video starts un-nudged. Coming back never
 * finishes the video by itself.
 */
export function useReturnNudge(watching: string | null): boolean {
  const [nudgedFor, setNudgedFor] = useState<string | null>(null);

  useEffect(() => {
    if (watching === null) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") setNudgedFor(watching);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [watching]);

  return watching !== null && nudgedFor === watching;
}
