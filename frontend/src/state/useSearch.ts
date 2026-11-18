import { useMemo, useState, type Dispatch } from "react";
import { searchCatalog, suggestionCorpus } from "../domain/search";
import type { CompositionFilters, Video } from "../domain/types";
import type { Action } from "./appState";
import { useTimedValue } from "./useTimedValue";

const FLASH_MS = 5000;

type Input = Readonly<{
  catalog: readonly Video[];
  recent: readonly string[];
  filters: Pick<CompositionFilters, "hideClickbait">;
  dispatch: Dispatch<Action>;
  /** Shows the search page. */
  openPage: () => void;
}>;

/** Searching the catalog: suggestions, the last search and its results, recent searches and voice-search messages. */
export function useSearch({ catalog, recent, filters, dispatch, openPage }: Input) {
  const [query, setQuery] = useState("");
  const [flash, showFlash] = useTimedValue<string>(FLASH_MS);
  const corpus = useMemo(() => suggestionCorpus(catalog), [catalog]);
  const results = useMemo(() => searchCatalog(catalog, query, filters), [catalog, query, filters]);

  return {
    corpus,
    recent,
    query,
    results,
    flash,
    showFlash,
    /** Searches for `text`, already checked to be non-blank, and remembers it. */
    search: (text: string) => {
      setQuery(text);
      dispatch({ type: "remember_search", query: text });
      openPage();
    },
    forget: (phrase: string) => dispatch({ type: "forget_search", query: phrase }),
  };
}

export type Search = ReturnType<typeof useSearch>;
