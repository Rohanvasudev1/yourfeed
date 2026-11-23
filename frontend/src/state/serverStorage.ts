import type { ServerStatePort, StateStorage } from "../ports";

/** Server storage plus a way to send again what didn't save. */
export type ServerStorage = StateStorage & Readonly<{ retry: () => void }>;

/**
 * State storage on the server (ADR 0012), opened with the document the server already loaded.
 * One save is in flight at a time; newer state waits and goes next, and state the server already has isn't sent again.
 * `onSaved(false)` reports a failed save; the next change, or `retry`, sends the newest state again.
 */
export function serverStorage(port: ServerStatePort, loaded: unknown, onSaved: (ok: boolean) => void): ServerStorage {
  let stored = JSON.stringify(loaded);
  let wanted: Readonly<{ value: unknown; json: string }> | null = null;
  let sending = false;

  const send = async (): Promise<void> => {
    if (sending || wanted === null || wanted.json === stored) return;
    const next = wanted;
    sending = true;
    try {
      await port.save(next.value);
      stored = next.json;
      onSaved(true);
    } catch (err: unknown) {
      console.error("Couldn't save your state to your account", err);
      onSaved(false);
      return;
    } finally {
      sending = false;
    }
    await send();
  };

  return {
    load: () => loaded,
    save: (value) => {
      wanted = { value, json: JSON.stringify(value) };
      void send();
    },
    retry: () => void send(),
  };
}
