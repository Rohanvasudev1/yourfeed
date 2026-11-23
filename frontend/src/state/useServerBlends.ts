import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { BLEND_TEXT, type ServerBlend } from "../domain/blend";
import type { SharingPort } from "../ports";
import type { Action } from "./appState";

type Options = Readonly<{
  /** Null in demo mode, where Blend's other people are simulated and nothing is fetched. */
  sharing: SharingPort | null;
  /** The Blend feed is open: each time it opens, the server is asked what changed. */
  looking: boolean;
  /** The visitor's recipe topics, which an invite or an approval carries. */
  mine: readonly string[];
  dispatch: Dispatch<Action>;
}>;

/**
 * Signed in, Blend's invites and approvals go through the server (ADR 0013). Its blends are fetched on load and each time
 * Blend opens, and again after every change, so the Blend feed always shows what the server has.
 */
export function useServerBlends({ sharing, looking, mine, dispatch }: Options) {
  const [rows, setRows] = useState<readonly ServerBlend[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fetched = useRef(false);
  // Fetches can finish out of order: only the newest one's answer is shown.
  const latest = useRef(0);

  const refresh = useCallback(
    async (open?: number) => {
      if (!sharing) return;
      const request = ++latest.current;
      const next = await sharing.blends();
      if (request !== latest.current) return;
      setRows(next);
      dispatch({ type: "sync_blends", rows: next, ...(open !== undefined && { open }) });
    },
    [sharing, dispatch],
  );

  useEffect(() => {
    // After the first fetch, only opening Blend fetches again, not leaving it.
    if (!sharing || (fetched.current && !looking)) return;
    fetched.current = true;
    refresh().catch((err: unknown) => console.error("Couldn't fetch your blends", err));
  }, [refresh, looking]);

  /** Runs one change against the server, then shows what the server has; says so when it couldn't. */
  const run = async (change: () => Promise<number | void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await refresh((await change()) ?? undefined);
    } catch (err: unknown) {
      console.error("Couldn't change a blend", err);
      setProblem(BLEND_TEXT.failed);
    } finally {
      setBusy(false);
    }
  };

  return {
    /** Invites sent to this user, waiting for them to approve or decline. */
    invites: rows.filter((r) => r.role === "invitee" && r.status === "pending"),
    problem,
    busy,
    /** Resolves to why the server refused, or null once the invite is sent. */
    invite: async (name: string): Promise<string | null> => {
      setBusy(true);
      setProblem(null);
      try {
        if (!sharing) return null;
        const answer = await sharing.inviteBlend(name, mine);
        if (!answer.ok) return answer.problem;
      } catch (err: unknown) {
        console.error("Couldn't send a blend invite", err);
        setBusy(false);
        return BLEND_TEXT.failed;
      }
      // The invite went out; if showing it fails, the next fetch shows it.
      await refresh().catch((err: unknown) => console.error("Couldn't fetch your blends", err));
      setBusy(false);
      return null;
    },
    cancel: (id: number) => run(async () => sharing?.cancelBlend(id)),
    /** Approves an invite and opens the blend. */
    accept: (id: number) => run(async () => (await sharing?.acceptBlend(id, mine))?.id),
  };
}
