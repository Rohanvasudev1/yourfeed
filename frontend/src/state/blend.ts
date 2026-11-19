import { blendTopics, myTopics, type Blend, type BlendPartner } from "../domain/blend";
import type { Feed } from "../domain/types";

/** Changes to a Blend feed's partner and to the visitor's blends. Each names the Blend feed it changes. */
export type BlendAction =
  /** Invites someone, whose taste the caller already worked out; the blend waits for their approval. */
  | Readonly<{ type: "invite_blend"; feed: string; partner: BlendPartner }>
  /** Cancel invite, and Change partner on an approved blend: back to asking for a username. */
  | Readonly<{ type: "clear_blend"; feed: string }>
  /** Demo only: the invited person approves, and the blend joins the visitor's blends. */
  | Readonly<{ type: "approve_blend"; feed: string }>
  /** Opens one of the visitor's blends in the Blend feed. */
  | Readonly<{ type: "open_blend"; feed: string; name: string }>
  /** Removes one of the visitor's blends, clearing the Blend feed if it's the one open. */
  | Readonly<{ type: "forget_blend"; feed: string; name: string }>;

type WithBlends = Readonly<{ feeds: readonly Feed[]; blends: readonly BlendPartner[] }>;

const BLEND_ACTION_TYPES: ReadonlySet<string> = new Set<BlendAction["type"]>([
  "invite_blend",
  "clear_blend",
  "approve_blend",
  "open_blend",
  "forget_blend",
]);

export const isBlendAction = (action: { type: string }): action is BlendAction => BLEND_ACTION_TYPES.has(action.type);

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const blendFeed = (state: WithBlends, name: string) => state.feeds.find((f) => f.name === name && f.kind === "blend");

function setPartner<S extends WithBlends>(state: S, feed: string, partner: Blend | null): S {
  const topics = partner?.status === "accepted" ? blendTopics(myTopics(state.feeds), partner.topics) : [];
  return { ...state, feeds: state.feeds.map((f) => (f.name === feed ? { ...f, partner, topics } : f)) };
}

const isOpen = (feed: Feed, name: string) => feed.partner?.status === "accepted" && sameName(feed.partner.name, name);

/** Applies a blend action; one naming a feed that isn't a Blend feed changes nothing. */
export function reduceBlend<S extends WithBlends>(state: S, action: BlendAction): S {
  const feed = blendFeed(state, action.feed);
  if (!feed) return state;
  switch (action.type) {
    case "invite_blend":
      return setPartner(state, feed.name, { ...action.partner, status: "pending" });
    case "clear_blend":
      return feed.partner ? setPartner(state, feed.name, null) : state;
    case "approve_blend": {
      if (feed.partner?.status !== "pending") return state;
      const { name, topics, score } = feed.partner;
      const blends = [{ name, topics, score }, ...state.blends.filter((b) => !sameName(b.name, name))];
      return setPartner({ ...state, blends }, feed.name, { ...feed.partner, status: "accepted" });
    }
    case "open_blend": {
      const blend = state.blends.find((b) => b.name === action.name);
      if (!blend || isOpen(feed, blend.name)) return state;
      return setPartner(state, feed.name, { ...blend, status: "accepted" });
    }
    case "forget_blend": {
      if (!state.blends.some((b) => b.name === action.name)) return state;
      const forgotten = { ...state, blends: state.blends.filter((b) => b.name !== action.name) };
      return isOpen(feed, action.name) ? setPartner(forgotten, feed.name, null) : forgotten;
    }
  }
}
