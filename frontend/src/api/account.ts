import { z } from "zod";
import type { AccountStatus, DeleteResult } from "../domain/account";
import type { AccountPort } from "../ports";

const statusSchema = z.object({ signInAvailable: z.boolean(), signedIn: z.boolean(), csrfToken: z.string().min(1).nullable() });
const deleteSchema = z.object({ revoked: z.boolean() });

const LOGIN_PATH = "/api/auth/login";
const CSRF_HEADER = "X-CSRF-Token";
/** The backend sends a failed sign-in back to `/?signin=failed`. */
const FAILED_PARAM = "signin";

type Envelope = { success?: boolean; data?: unknown; error?: string | null };

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  const body = (await res.json().catch(() => null)) as Envelope | null;
  if (!body?.success) throw new Error(body?.error ?? `The server answered ${res.status}.`);
  return body.data;
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
 * The backend's account API. It keeps the session's CSRF token, which every write sends back.
 * Whether sign-in just failed is read once, when the page opens, so asking for the status twice gives the same answer.
 */
export function apiAccount(): AccountPort {
  const signInFailed = takeSignInFailed();
  let csrfToken: string | null = null;
  const write = (path: string, method: string) =>
    call(path, { method, headers: csrfToken ? { [CSRF_HEADER]: csrfToken } : {} });

  return {
    status: async (): Promise<AccountStatus> => {
      const status = statusSchema.parse(await call("/api/auth/me"));
      csrfToken = status.csrfToken;
      if (!status.signInAvailable) return { kind: "unavailable" };
      return status.signedIn ? { kind: "signedIn" } : { kind: "signedOut", signInFailed };
    },
    signIn: () => window.location.assign(LOGIN_PATH),
    signOut: async () => {
      await write("/api/auth/logout", "POST");
      csrfToken = null;
    },
    deleteData: async (): Promise<DeleteResult> => {
      const result = deleteSchema.parse(await write("/api/account", "DELETE"));
      csrfToken = null;
      return result;
    },
  };
}
