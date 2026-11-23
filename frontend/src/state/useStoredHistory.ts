import { useReducer, useState } from "react";
import type { StateStorage } from "../ports";
import { makeReducer, type AppState } from "./appState";
import { startHistory, withHistory, type History } from "./history";
import { restoreState } from "./persistence";
import { ACCOUNT_SEED, DEMO_SEED } from "./seed";

const reducersOf = (seed: AppState) => {
  const base = makeReducer(seed);
  return { base, history: withHistory(base) } as const;
};
/** The reducers for each starting point, built once so React always sees the same reducer for one. */
const DEMO = reducersOf(DEMO_SEED);
const ACCOUNT = reducersOf(ACCOUNT_SEED);
const reducersFor = (seed: AppState) => (seed === ACCOUNT_SEED ? ACCOUNT : DEMO);

/** Reloading leaves an unnamed draft, so it's dropped like any other time you leave it. Nothing saved yet starts from `seed`. */
const restore = (storage: StateStorage, seed: AppState) =>
  reducersFor(seed).base(restoreState(storage.load(), seed), { type: "leave_draft" });

/**
 * App state with its undo history, restored from `storage`; `usePersist` saves it back. When `storage` changes (signing
 * out swaps the server for the browser), the state is swapped for that storage's in the same render, so one storage's
 * state is never saved to the other.
 */
export function useStoredHistory(storage: StateStorage, seed: AppState) {
  const [history, dispatch] = useReducer(reducersFor(seed).history, storage, (s) => startHistory(restore(s, seed)));
  const [source, setSource] = useState(storage);
  if (source !== storage) {
    setSource(storage);
    dispatch({ type: "load", present: restore(storage, seed) });
  }
  return [history, dispatch] as readonly [History, typeof dispatch];
}
