import { useEffect, useRef, type Dispatch } from "react";
import type { SharingPort } from "../ports";
import type { Action } from "./appState";

type Options = Readonly<{
  sharing: SharingPort | null;
  /** The newest sent share the inbox has had. */
  cursor: number;
  /** Shared with you is open: each time it opens, what arrived since is fetched. */
  looking: boolean;
  dispatch: Dispatch<Action>;
}>;

/** Signed in, brings feeds others sent by username into Shared with you: on load, and each time Shared with you opens. */
export function useSentShares({ sharing, cursor, looking, dispatch }: Options): void {
  const latest = useRef(cursor);
  const fetched = useRef(false);
  useEffect(() => {
    latest.current = cursor;
  });

  useEffect(() => {
    // After the first fetch, only opening Shared with you fetches again, not leaving it.
    if (!sharing || (fetched.current && !looking)) return;
    fetched.current = true;
    // Not cancelled on cleanup: receiving is idempotent, and StrictMode's second run would skip the fetch.
    sharing
      .inbox(latest.current)
      .then((shares) => {
        if (shares.length > 0) dispatch({ type: "receive_sent", shares });
      })
      .catch((err: unknown) => console.error("Couldn't fetch what others sent you", err));
  }, [sharing, looking, dispatch]);
}
