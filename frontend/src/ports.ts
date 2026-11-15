import type { Video } from "./domain/types";

/** Loads the catalog the feeds are built from. Production calls the backend; tests pass a fixed list. */
export type CatalogLoader = () => Promise<readonly Video[]>;

/** Keeps app state between visits. `load` returns untrusted data (or null when nothing is saved). */
export type StateStorage = Readonly<{
  load: () => unknown;
  save: (value: unknown) => void;
}>;
