import { z } from "zod";
import type { AccountStatus, DeleteResult, UsernameAnswer } from "../domain/account";
import { USERNAME_PATTERN } from "../domain/username";
import type { AccountPort } from "../ports";
import { ApiError, apiSession, type ApiSession } from "./session";

const username = z.string().regex(USERNAME_PATTERN);
const statusSchema = z.object({
  signInAvailable: z.boolean(),
  signedIn: z.boolean(),
  csrfToken: z.string().min(1).nullable(),
  username: username.nullable().default(null),
});
const deleteSchema = z.object({ revoked: z.boolean() });
const usernameSchema = z.object({ username });

const USERNAME_PATH = "/api/account/username";
/** Statuses where the server refused the username itself (broken rules, taken) and said why in the visitor's words. */
const REFUSED = new Set([409, 422]);

const LOGIN_PATH = "/api/auth/login";
/** The backend sends a failed sign-in back to `/?signin=failed`. */
const FAILED_PARAM = "signin";

/** Remembers in this browser that it's signed in, so the next visit waits for the account. Storage may be blocked; then it just doesn't remember. */
const SIGNED_IN_KEY = "yourfeed.signedIn";

function rememberSignedIn(signedIn: boolean): void {
  try {
    if (signedIn) window.localStorage.setItem(SIGNED_IN_KEY, "1");
    else window.localStorage.removeItem(SIGNED_IN_KEY);
  } catch (err) {
    console.warn("Couldn't remember whether you're signed in", err);
  }
}

function rememberedSignedIn(): boolean {
  try {
    return window.localStorage.getItem(SIGNED_IN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Reads, then removes, the failed-sign-in marker, so a reload doesn't say it again. */
function takeSignInFailed(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.get(FAILED_PARAM) !== "failed") return false;
  url.searchParams.delete(FAILED_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
  return true;
}

/**
 * The backend's account API. It hands the session's CSRF token to `session`, which every write sends back.
 * Whether sign-in just failed is read once, when the page opens, so asking for the status twice gives the same answer.
 */
export function apiAccount(session: ApiSession = apiSession()): AccountPort {
  const signInFailed = takeSignInFailed();
  const { call, write } = session;

  return {
    status: async (): Promise<AccountStatus> => {
      const status = statusSchema.parse(await call("/api/auth/me"));
      session.setCsrfToken(status.csrfToken);
      rememberSignedIn(status.signedIn);
      if (!status.signInAvailable) return { kind: "unavailable" };
      return status.signedIn ? { kind: "signedIn", username: status.username } : { kind: "signedOut", signInFailed };
    },
    expectsSignedIn: rememberedSignedIn,
    signIn: () => window.location.assign(LOGIN_PATH),
    signOut: async () => {
      await write("/api/auth/logout", "POST");
      session.setCsrfToken(null);
      rememberSignedIn(false);
    },
    chooseUsername: async (name): Promise<UsernameAnswer> => {
      try {
        return { ok: true, ...usernameSchema.parse(await write(USERNAME_PATH, "PUT", { username: name })) };
      } catch (err: unknown) {
        if (err instanceof ApiError && REFUSED.has(err.status)) return { ok: false, problem: err.message };
        throw err;
      }
    },
    deleteData: async (): Promise<DeleteResult> => {
      const result = deleteSchema.parse(await write("/api/account", "DELETE"));
      session.setCsrfToken(null);
      rememberSignedIn(false);
      return result;
    },
  };
}
