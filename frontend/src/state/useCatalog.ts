import { useEffect, useState } from "react";
import type { Video } from "../domain/types";
import type { CatalogLoader } from "../ports";

export type CatalogState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "error"; message: string }>
  | Readonly<{ status: "ready"; catalog: readonly Video[] }>;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Couldn't load videos.");

/** Loads the catalog, and loads it again on `retry`. */
export function useCatalog(loadCatalog: CatalogLoader): readonly [CatalogState, () => void] {
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setCatalog({ status: "loading" });
    loadCatalog()
      .then((videos) => live && setCatalog({ status: "ready", catalog: videos }))
      .catch((err: unknown) => {
        console.error("Catalog failed to load", err);
        if (live) setCatalog({ status: "error", message: errorMessage(err) });
      });
    return () => {
      live = false;
    };
  }, [loadCatalog, attempt]);

  return [catalog, () => setAttempt((n) => n + 1)] as const;
}
