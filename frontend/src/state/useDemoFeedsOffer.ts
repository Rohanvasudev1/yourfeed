import { useMemo } from "react";
import { demoRecipes, type DemoRecipe } from "../domain/demoFeeds";
import type { Feed, Video } from "../domain/types";
import type { Action } from "./appState";

export type DemoFeedsOffer = Readonly<{ recipes: readonly DemoRecipe[]; bring: () => void; decline: () => void }>;

type Input = Readonly<{
  /** The browser's demo feeds when signed in; null in demo mode, where there's nothing to bring. */
  demoFeeds: readonly Feed[] | null;
  offered: boolean;
  /** The signed-in catalog, once loaded: only its topics come along. */
  catalog: readonly Video[] | null;
  dispatch: (action: Action) => void;
}>;

/** Bring your demo feeds, while it's on offer: once per account, when there are demo feeds and the catalog has loaded. */
export function useDemoFeedsOffer({ demoFeeds, offered, catalog, dispatch }: Input): DemoFeedsOffer | null {
  const recipes = useMemo(() => (demoFeeds && catalog ? demoRecipes(demoFeeds, catalog) : []), [demoFeeds, catalog]);
  if (offered || recipes.length === 0) return null;
  return {
    recipes,
    bring: () => dispatch({ type: "answer_demo_offer", recipes }),
    decline: () => dispatch({ type: "answer_demo_offer", recipes: [] }),
  };
}
