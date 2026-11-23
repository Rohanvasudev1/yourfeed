import type { ServerStatePort } from "../ports";

/**
 * A stand-in for the backend's state API: keeps the saved document in memory, counts calls, and fails the next
 * `failLoads` loads and `failSaves` saves.
 */
export function fakeServerState(initial: unknown = null) {
  let document = initial;
  const calls = { load: 0, save: 0 };
  const failures = { loads: 0, saves: 0 };
  const port: ServerStatePort = {
    load: async () => {
      calls.load += 1;
      if (failures.loads > 0) {
        failures.loads -= 1;
        throw new Error("The server answered 503.");
      }
      return document;
    },
    save: async (value) => {
      calls.save += 1;
      if (failures.saves > 0) {
        failures.saves -= 1;
        throw new Error("The server answered 503.");
      }
      document = value;
    },
  };
  return {
    ...port,
    calls,
    saved: () => document,
    failLoads: (times: number) => {
      failures.loads = times;
    },
    failSaves: (times: number) => {
      failures.saves = times;
    },
  };
}
