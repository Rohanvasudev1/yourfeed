import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import type { CatalogLoader, StateStorage } from "../ports";
import { CATALOG, memoryStorage } from "./fixtures";

export type RenderAppOptions = { loadCatalog?: CatalogLoader; storage?: StateStorage };

/** Renders the whole app the way production does, with a fixed catalog and in-memory storage by default. */
export function renderApp({ loadCatalog = async () => CATALOG, storage = memoryStorage() }: RenderAppOptions = {}) {
  return render(<App loadCatalog={loadCatalog} storage={storage} />);
}

export const upNextList = () => screen.findByRole("list", { name: "Up next" });

/** Titles of the cards in Up next, in order. */
export async function feedTitles(): Promise<string[]> {
  return within(await upNextList())
    .queryAllByRole("heading", { level: 3 })
    .map((h) => h.textContent ?? "");
}

/** The Up next card whose title is `title`. */
export async function cardFor(title: string): Promise<HTMLElement> {
  const heading = within(await upNextList()).getByRole("heading", { level: 3, name: title });
  const card = heading.closest("li");
  if (!card) throw new Error(`No card around "${title}"`);
  return card;
}

export const settingsLine = () => screen.getByRole("group", { name: "Feed settings" });

/** The settings line phrase that opens the filters popup ("4 filters on", "no filters"). */
export const filtersButton = () => within(settingsLine()).getByRole("button", { name: /^(\d+ filters? on|no filters)$/ });

/** Flips global filters the way a user does: opens the filters popup, clicks each switch by name, then closes it. */
export async function toggleFilters(...names: readonly string[]): Promise<void> {
  await userEvent.click(filtersButton());
  const popup = await screen.findByRole("dialog", { name: "Filters and display" });
  for (const name of names) await userEvent.click(within(popup).getByRole("switch", { name }));
  await userEvent.keyboard("{Escape}");
}
