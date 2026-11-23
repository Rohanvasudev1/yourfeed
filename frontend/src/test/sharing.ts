import type { InviteAnswer, ServerBlend } from "../domain/blend";
import type { SendAnswer, SentShare } from "../domain/sending";
import type { Share } from "../domain/share";
import type { Video } from "../domain/types";
import type { SharingPort } from "../ports";

type Script = Readonly<{
  /** Videos YouTube has outside the user's catalog. */
  youtube?: readonly Video[];
  /** Usernames that exist. */
  people?: readonly string[];
  /** What was already sent to this user. */
  sent?: readonly SentShare[];
  /** This user's blends on the server, newest first. */
  blends?: readonly ServerBlend[];
  /** Makes every call but the inbox fail, as if the server were down. */
  down?: boolean;
}>;

const NO_ONE = "No one has that username.";

/** A stand-in for the backend's sharing API: YouTube lookups, sends to usernames and this user's inbox, in memory. */
export function fakeSharing({ youtube = [], people = ["maya.k"], sent = [], blends: initialBlends = [], down = false }: Script = {}) {
  const calls = {
    lookups: [] as (readonly string[])[],
    sends: [] as { to: string; share: Share }[],
    inbox: [] as number[],
    invites: [] as { to: string; topics: readonly string[] }[],
    accepts: [] as { id: number; topics: readonly string[] }[],
    cancels: [] as number[],
  };
  // What each inviter's topics turn out to be once this user approves.
  const theirTopics = new Map<number, readonly string[]>();
  let blends: readonly ServerBlend[] = initialBlends;
  let nextId = Math.max(100, ...initialBlends.map((b) => b.id + 1));
  const blendOf = (id: number) => blends.find((b) => b.id === id);
  const replace = (blend: ServerBlend) => {
    blends = blends.map((b) => (b.id === blend.id ? blend : b));
  };
  const inbox = [...sent];
  const fail = () => Promise.reject(new Error("The server answered 503."));
  // Ids whose next lookup fails once.
  let failing: ReadonlySet<string> = new Set();
  const port: SharingPort = {
    lookupVideos: async (ids) => {
      calls.lookups.push(ids);
      if (down) return fail();
      if (ids.some((id) => failing.has(id))) {
        failing = new Set([...failing].filter((id) => !ids.includes(id)));
        return fail();
      }
      return youtube.filter((v) => ids.includes(v.id));
    },
    send: async (to, share) => {
      calls.sends.push({ to, share });
      if (down) return fail();
      const name = to.toLowerCase();
      const answer: SendAnswer = people.includes(name) ? { ok: true, to: name } : { ok: false, problem: NO_ONE };
      return answer;
    },
    blends: async () => (down ? fail() : blends),
    inviteBlend: async (to, topics) => {
      calls.invites.push({ to, topics });
      if (down) return fail();
      const name = to.toLowerCase();
      if (!people.includes(name)) return { ok: false, problem: NO_ONE } satisfies InviteAnswer;
      if (blends.some((b) => b.with === name)) return { ok: false, problem: `You already have a blend with @${name}.` } satisfies InviteAnswer;
      const blend: ServerBlend = { id: nextId++, with: name, role: "inviter", status: "pending", topics: [] };
      blends = [blend, ...blends];
      return { ok: true, blend } satisfies InviteAnswer;
    },
    acceptBlend: async (id, topics) => {
      calls.accepts.push({ id, topics });
      const blend = blendOf(id);
      if (down || !blend) return fail();
      const accepted: ServerBlend = { ...blend, status: "accepted", topics: theirTopics.get(id) ?? [] };
      replace(accepted);
      return accepted;
    },
    cancelBlend: async (id) => {
      calls.cancels.push(id);
      if (down) return fail();
      blends = blends.filter((b) => b.id !== id);
    },
    inbox: async (after) => {
      calls.inbox.push(after);
      return inbox.filter((s) => s.id > after);
    },
  };
  return {
    ...port,
    calls,
    /** Someone invites this user to blend; `topics` are theirs, shown once this user approves. */
    theyInvite: (from: string, topics: readonly string[]) => {
      const blend: ServerBlend = { id: nextId++, with: from, role: "invitee", status: "pending", topics: [] };
      theirTopics.set(blend.id, topics);
      blends = [blend, ...blends];
      return blend.id;
    },
    /** The other person approves this user's invite in their own account, with their topics. */
    theyApprove: (id: number, topics: readonly string[]) => {
      const blend = blendOf(id);
      if (blend) replace({ ...blend, status: "accepted", topics });
    },
    /** The other person cancels or removes the blend in their own account. */
    theyCancel: (id: number) => {
      blends = blends.filter((b) => b.id !== id);
    },
    failNextLookupOf: (id: string) => {
      failing = new Set([...failing, id]);
    },
  };
}
