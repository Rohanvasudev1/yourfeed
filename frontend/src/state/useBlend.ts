import { useMemo, type Dispatch } from "react";
import { blendRecipe, myTopics, tasteOf, type BlendPartner } from "../domain/blend";
import type { Feed, Video } from "../domain/types";
import type { SharingPort } from "../ports";
import type { HistoryAction } from "./history";
import { useServerBlends } from "./useServerBlends";

type Options = Readonly<{
  feeds: readonly Feed[];
  /** The open feed: the Blend panel only shows on a Blend feed. */
  feed: Feed;
  catalog: readonly Video[];
  /** Signed in, Blend is real (ADR 0013); null in demo mode, where other people are simulated (ADR 0008). */
  sharing: SharingPort | null;
  dispatch: Dispatch<HistoryAction>;
}>;

/** What the Blend panel can do to the open Blend feed and the visitor's blends. */
export function useBlend({ feeds, feed, catalog, sharing, dispatch }: Options) {
  const catalogTopics = useMemo(() => [...new Set(catalog.map((v) => v.topic))], [catalog]);
  const mine = useMemo(() => myTopics(feeds), [feeds]);
  const recipe = useMemo(() => blendRecipe(feeds), [feeds]);
  const server = useServerBlends({ sharing, looking: feed.kind === "blend", mine: recipe, dispatch });
  const local = {
    invite: async (name: string) => {
      dispatch({ type: "invite_blend", feed: feed.name, partner: tasteOf(name, mine, catalogTopics) });
      return null;
    },
    clear: () => dispatch({ type: "clear_blend", feed: feed.name }),
    forget: (name: string) => dispatch({ type: "forget_blend", feed: feed.name, name }),
  };
  return {
    /** Demo mode: the invited person's approval can be simulated. */
    simulated: sharing === null,
    /** Demo taste comes from the catalog's topics, so inviting waits until it has loaded. */
    canInvite: catalogTopics.length > 0 && !server.busy,
    /** Resolves to why the invite wasn't sent, or null. */
    invite: sharing ? server.invite : local.invite,
    /** Cancel invite (on the server, signed in), and Change partner on an approved blend: back to asking for a username. */
    clear: () => {
      const id = feed.partner?.status === "pending" ? feed.partner.id : undefined;
      return sharing && id !== undefined ? server.cancel(id) : local.clear();
    },
    approve: () => dispatch({ type: "approve_blend", feed: feed.name }),
    open: (name: string) => dispatch({ type: "open_blend", feed: feed.name, name }),
    /** Removes one of the visitor's blends: signed in, it ends for both people. */
    forget: ({ id, name }: BlendPartner) => (sharing && id !== undefined ? server.cancel(id) : local.forget(name)),
    invites: server.invites,
    accept: server.accept,
    decline: server.cancel,
    problem: server.problem,
  };
}

export type BlendControls = ReturnType<typeof useBlend>;
