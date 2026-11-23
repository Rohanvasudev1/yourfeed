import { useEffect, useRef, type Dispatch } from "react";
import type { SharingPort } from "../ports";
import type { Action } from "./appState";

type Options = Readonly<{
  sharing: SharingPort | null;
  /** The newest sent share the inbox has had. */
  cursor: number;
  /** Shared with you is open: what arrived since is fetched again. */
  looking: boolean;
  dispatch: Dispatch<Action>;
}>;

/** Signed in, brings feeds others sent by username into Shared with you: on load, and each time Shared with you opens. */
export function useSentShares({ sharing, cursor, looking, dispatch }: Options): void {
  const latest = useRef(cursor);
  useEffect(() => {
    latest.current = cursor;
  });

  useEffect(() => {
    if (!sharing) return;
    let live = true;
    sharing
      .inbox(latest.current)
      .then((shares) => {
        if (live && shares.length > 0) dispatch({ type: "receive_sent", shares });
      })
      .catch((err: unknown) => console.error("Couldn't fetch what others sent you", err));
    return () => {
      live = false;
    };
  }, [sharing, looking, dispatch]);
}
