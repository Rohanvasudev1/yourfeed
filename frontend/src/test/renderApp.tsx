import { render, screen, within } from "@testing-library/react";
import App from "../App";
import type { CatalogLoader, StateStorage } from "../ports";
import type { GlobalFilters } from "../domain/types";
import { CATALOG, memoryStorage } from "./fixtures";

export type Setup = { loadCatalog?: CatalogLoader; storage?: StateStorage };

/** Renders the whole app the way production does, with a fixed catalog and in-memory storage by default. */
export function renderApp({ loadCatalog = async () => CATALOG, storage = memoryStorage() }: Setup = {}) {
  return render(<App loadCatalog={loadCatalog} storage={storage} />);
}

export const upNextList = () => screen.findByRole("list", { name: "Up next" });

/** Titles of the cards in Up next, in order. */
export async function feedTitles(): Promise<string[]> {
  return within(await upNextList())
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent ?? "");
}

/** The Up next card whose title is `title`. */
export async function cardFor(title: string): Promise<HTMLElement> {
  const heading = within(await upNextList()).getByRole("heading", { level: 3, name: title });
  const card = heading.closest("li");
  if (!card) throw new Error(`No card around "${title}"`);
  return card;
}

type Saved = { state: { filters: GlobalFilters } };

/**
 * What the app saves on a first visit, with some global filters changed. This reads the saved
 * shape only because no filter controls exist yet; switch callers to clicking the filters popup
 * once that lands.
 */
export async function savedWithFilters(filters: Partial<GlobalFilters>): Promise<Saved> {
  const storage = memoryStorage();
  const { unmount } = renderApp({ storage });
  await feedTitles();
  unmount();
  const saved = storage.saved() as Saved;
  return { ...saved, state: { ...saved.state, filters: { ...saved.state.filters, ...filters } } };
}
