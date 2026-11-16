import { useEffect, useState } from "react";

/**
 * True once the visitor comes back to the page while a video is Watching now, so the Finished
 * button can ask whether they're done. Coming back never finishes the video by itself.
 */
export function useReturnNudge(watching: boolean): readonly [boolean, () => void] {
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    if (!watching) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") setNudge(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [watching]);

  return [nudge && watching, () => setNudge(false)] as const;
}
