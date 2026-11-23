import { useCallback, useEffect, useState } from "react";
import type { ServerStatePort, StateStorage } from "../ports";
import { serverStorage, type ServerStorage } from "./serverStorage";
import type { AccountControls } from "./useAccount";

/**
 * Where app state is kept. `waiting` while a signed-in visitor's state loads.
 * Signed in, it's the server; otherwise the browser (demo mode).
 */
export type StateSource =
  | Readonly<{ phase: "waiting" }>
  | Readonly<{ phase: "loadFailed"; retry: () => void }>
  | Readonly<{ phase: "ready"; storage: StateStorage; saveFailed: boolean; retrySave: () => void }>;

type Server =
  | Readonly<{ phase: "waiting" }>
  | Readonly<{ phase: "loadFailed" }>
  | Readonly<{ phase: "ready"; storage: ServerStorage; saveFailed: boolean }>;

const WAITING: Server = { phase: "waiting" };
const noop = () => {};

/**
 * Picks browser or server storage from the account status, loading the signed-in user's state from the server first.
 * Until the server has answered, a browser that was signed in last time waits; any other shows the demo straight away.
 */
export function useStateSource(
  account: Pick<AccountControls, "status" | "checked">,
  expectsSignedIn: boolean,
  browser: StateStorage,
  port: ServerStatePort,
): StateSource {
  const { status, checked } = account;
  const signedIn = status?.kind === "signedIn";
  const [server, setServer] = useState<Server>(WAITING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const onSaved = (ok: boolean) => {
      if (live) setServer((s) => (s.phase === "ready" && s.saveFailed === ok ? { ...s, saveFailed: !ok } : s));
    };
    port
      .load()
      .then((loaded) => live && setServer({ phase: "ready", storage: serverStorage(port, loaded, onSaved), saveFailed: false }))
      .catch((err: unknown) => {
        console.error("Couldn't load your state from your account", err);
        if (live) setServer({ phase: "loadFailed" });
      });
    return () => {
      live = false;
      setServer(WAITING);
    };
  }, [signedIn, port, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!checked && expectsSignedIn) return { phase: "waiting" };
  if (!signedIn) return { phase: "ready", storage: browser, saveFailed: false, retrySave: noop };
  if (server.phase === "loadFailed") return { phase: "loadFailed", retry };
  if (server.phase === "waiting") return server;
  return { phase: "ready", storage: server.storage, saveFailed: server.saveFailed, retrySave: server.storage.retry };
}
