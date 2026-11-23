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
  /** Makes every send and lookup fail, as if the server were down. */
  down?: boolean;
}>;

/** A stand-in for the backend's sharing API: YouTube lookups, sends to usernames and this user's inbox, in memory. */
export function fakeSharing({ youtube = [], people = ["maya.k"], sent = [], down = false }: Script = {}) {
  const calls = { lookups: [] as (readonly string[])[], sends: [] as { to: string; share: Share }[], inbox: [] as number[] };
  const inbox = [...sent];
  const fail = () => Promise.reject(new Error("The server answered 503."));
  const port: SharingPort = {
    lookupVideos: async (ids) => {
      calls.lookups.push(ids);
      if (down) return fail();
      return youtube.filter((v) => ids.includes(v.id));
    },
    send: async (to, share) => {
      calls.sends.push({ to, share });
      if (down) return fail();
      const name = to.toLowerCase();
      const answer: SendAnswer = people.includes(name) ? { ok: true, to: name } : { ok: false, problem: "No one has that username." };
      return answer;
    },
    inbox: async (after) => {
      calls.inbox.push(after);
      return inbox.filter((s) => s.id > after);
    },
  };
  return { ...port, calls, deliver: (share: SentShare) => inbox.push(share) };
}
