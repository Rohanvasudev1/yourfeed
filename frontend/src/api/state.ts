import type { ServerStatePort } from "../ports";
import type { ApiSession } from "./session";

const STATE_PATH = "/api/state";

/** The backend's state API: the signed-in user's whole app state as one document (ADR 0012). */
export function apiServerState(session: ApiSession): ServerStatePort {
  return {
    load: () => session.call(STATE_PATH),
    save: async (value) => {
      await session.write(STATE_PATH, "PUT", value);
    },
  };
}
