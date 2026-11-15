import { useEffect, useRef } from "react";
import type { StateStorage } from "../ports";
import type { AppState } from "./appState";
import { toSaved } from "./persistence";

export const SAVE_DELAY_MS = 300;

/** Saves state shortly after it changes, and right away when the page is hidden or the app unmounts. */
export function usePersist(storage: StateStorage, state: AppState): void {
  const latest = useRef(state);

  useEffect(() => {
    latest.current = state;
    const timer = setTimeout(() => storage.save(toSaved(state)), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [storage, state]);

  useEffect(() => {
    const flush = () => storage.save(toSaved(latest.current));
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [storage]);
}
