const CSRF_HEADER = "X-CSRF-Token";
/** Browsers refuse `keepalive` requests over 64 KB; under that, a save sent as the page closes still arrives. */
const KEEPALIVE_MAX_CHARS = 60_000;

type Envelope = { success?: boolean; data?: unknown; error?: string | null };

/** The server answered, but not with success: `status` is its HTTP status and the message its error, when it sent one. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Calls to the backend in the visitor's session. It keeps the session's CSRF token, which `/api/auth/me` hands out
 * and every write sends back, so the account and state clients share one.
 */
export type ApiSession = Readonly<{
  call: (path: string, init?: RequestInit) => Promise<unknown>;
  write: (path: string, method: string, body?: unknown) => Promise<unknown>;
  setCsrfToken: (token: string | null) => void;
}>;

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  const body = (await res.json().catch(() => null)) as Envelope | null;
  if (!body?.success) throw new ApiError(body?.error ?? `The server answered ${res.status}.`, res.status);
  return body.data;
}

export function apiSession(): ApiSession {
  let csrfToken: string | null = null;
  return {
    call,
    write: (path, method, body) => {
      const headers: Record<string, string> = csrfToken ? { [CSRF_HEADER]: csrfToken } : {};
      if (body === undefined) return call(path, { method, headers });
      const json = JSON.stringify(body);
      return call(path, {
        method,
        headers: { ...headers, "Content-Type": "application/json" },
        body: json,
        keepalive: json.length <= KEEPALIVE_MAX_CHARS,
      });
    },
    setCsrfToken: (token) => {
      csrfToken = token;
    },
  };
}
