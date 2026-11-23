import { useEffect, useRef, type Dispatch } from "react";
import { flushSync } from "react-dom";
import type { Action } from "./appState";

/** The open feed's Up next, when its session has started: what leaving the page passes over. */
export type PassedOver = Readonly<{ feed: string; videos: readonly string[] }> | null;

/**
 * Leaving the page ends the session: the Up next videos it passed over are recorded skipped.
 * Call it before `usePersist`, so this pagehide listener runs first and the save includes the skips.
 * Returns the ref to keep pointed at what Up next shows now.
 */
export function useSessionEnd(dispatch: Dispatch<Action>) {
  const passedOver = useRef<PassedOver>(null);
  useEffect(() => {
    const end = () => {
      const shown = passedOver.current;
      if (shown && shown.videos.length > 0) flushSync(() => dispatch({ type: "end_session", ...shown, at: Date.now() }));
    };
    window.addEventListener("pagehide", end);
    return () => window.removeEventListener("pagehide", end);
  }, [dispatch]);
  return passedOver;
}
