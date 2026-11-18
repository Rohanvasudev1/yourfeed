import { forgetSearch, rememberSearch } from "../domain/search";

/** Changes to recent searches. Searching isn't a feed setting, so it never becomes an undo step. */
export type SearchAction =
  | Readonly<{ type: "remember_search"; query: string }>
  | Readonly<{ type: "forget_search"; query: string }>;

type WithRecent = Readonly<{ recentSearches: readonly string[] }>;

const SEARCH_ACTION_TYPES: ReadonlySet<string> = new Set<SearchAction["type"]>(["remember_search", "forget_search"]);

export const isSearchAction = (action: { type: string }): action is SearchAction => SEARCH_ACTION_TYPES.has(action.type);

export function reduceSearch<S extends WithRecent>(state: S, action: SearchAction): S {
  switch (action.type) {
    case "remember_search":
      return { ...state, recentSearches: rememberSearch(state.recentSearches, action.query) };
    case "forget_search":
      return state.recentSearches.includes(action.query)
        ? { ...state, recentSearches: forgetSearch(state.recentSearches, action.query) }
        : state;
  }
}
