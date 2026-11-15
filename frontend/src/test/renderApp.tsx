import { render, screen, within } from "@testing-library/react";
import App from "../App";
import type { CatalogLoader, StateStorage } from "../ports";
import { CATALOG, memoryStorage } from "./fixtures";

export type RenderAppOptions = { loadCatalog?: CatalogLoader; storage?: StateStorage };

/** Renders the whole app the way a visitor gets it, with an injected catalog and in-memory storage. */
export function renderApp({ loadCatalog = async () => CATALOG, storage = memoryStorage() }: RenderAppOptions = {}) {
  return render(<App loadCatalog={loadCatalog} storage={storage} />);
}

/** Titles in Up next, in order, once the catalog has loaded. */
export async function feedTitles(): Promise<string[]> {
  const feed = await screen.findByRole("list", { name: "Up next" });
  return within(feed)
    .queryAllByRole("heading", { level: 3 })
    .map((h) => h.textContent ?? "");
}
