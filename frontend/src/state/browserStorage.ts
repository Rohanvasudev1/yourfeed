import type { StateStorage } from "../ports";

export const STORAGE_KEY = "yourfeed.state";

/**
 * State storage on localStorage. Never throws: when storage is blocked or full, the app keeps
 * working from memory. `getStore` is a function because merely reading `window.localStorage`
 * throws in some private windows.
 */
export function browserStorage(getStore: () => Storage = () => window.localStorage): StateStorage {
  let warnedOnSave = false;
  return {
    load() {
      try {
        const raw = getStore().getItem(STORAGE_KEY);
        return raw === null ? null : (JSON.parse(raw) as unknown);
      } catch (err) {
        console.warn("Couldn't read saved state; starting from the demo.", err);
        return null;
      }
    },
    save(value) {
      try {
        getStore().setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (err) {
        if (!warnedOnSave) console.warn("Couldn't save state; changes will last until this tab closes.", err);
        warnedOnSave = true;
      }
    },
  };
}
