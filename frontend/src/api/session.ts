const CSRF_HEADER = "X-CSRF-Token";

type Envelope = { success?: boolean; data?: unknown; error?: string | null };

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
  if (!body?.success) throw new Error(body?.error ?? `The server answered ${res.status}.`);
  return body.data;
}

export function apiSession(): ApiSession {
  let csrfToken: string | null = null;
  return {
    call,
    write: (path, method, body) => {
      const headers: Record<string, string> = csrfToken ? { [CSRF_HEADER]: csrfToken } : {};
      if (body === undefined) return call(path, { method, headers });
      return call(path, { method, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    },
    setCsrfToken: (token) => {
      csrfToken = token;
    },
  };
}
