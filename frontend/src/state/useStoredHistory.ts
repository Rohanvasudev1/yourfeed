import { useReducer, useState } from "react";
import type { StateStorage } from "../ports";
import { makeReducer } from "./appState";
import { startHistory, withHistory, type History } from "./history";
import { restoreState } from "./persistence";
import { DEMO_SEED } from "./seed";

const baseReducer = makeReducer(DEMO_SEED);
const reducer = withHistory(baseReducer);

/** Reloading leaves an unnamed draft, so it's dropped like any other time you leave it. */
const restore = (storage: StateStorage) => baseReducer(restoreState(storage.load(), DEMO_SEED), { type: "leave_draft" });

/**
 * App state with its undo history, restored from `storage`; `usePersist` saves it back. When `storage` changes (signing
 * out swaps the server for the browser), the state is swapped for that storage's in the same render, so one storage's
 * state is never saved to the other.
 */
export function useStoredHistory(storage: StateStorage) {
  const [history, dispatch] = useReducer(reducer, storage, (s) => startHistory(restore(s)));
  const [source, setSource] = useState(storage);
  if (source !== storage) {
    setSource(storage);
    dispatch({ type: "load", present: restore(storage) });
  }
  return [history, dispatch] as readonly [History, typeof dispatch];
}
