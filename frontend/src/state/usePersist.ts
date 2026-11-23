import { useEffect, useRef } from "react";
import type { StateStorage } from "../ports";
import type { AppState } from "./appState";
import { toSaved } from "./persistence";

export const SAVE_DELAY_MS = 300;

/**
 * Saves state shortly after it changes, and right away when the page is hidden or the app unmounts.
 * Switching storage (signing out) saves nothing more to the old one: by then the server has ended the session.
 */
export function usePersist(storage: StateStorage, state: AppState): void {
  const latest = useRef({ storage, state });

  useEffect(() => {
    latest.current = { storage, state };
    const timer = setTimeout(() => storage.save(toSaved(state)), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [storage, state]);

  useEffect(() => {
    const flush = () => latest.current.storage.save(toSaved(latest.current.state));
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
}
