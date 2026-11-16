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

/** The open page's title: its first h2. Session and Feed notes sections add more h2s below it. */
export const openFeedTitle = () => screen.getAllByRole("heading", { level: 2 })[0].textContent;

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

export const filtersPopup = () => screen.findByRole("dialog", { name: "Filters and display" });

/** Flips global filters the way a user does: opens the filters popup, clicks each switch by name, then closes it. */
export async function toggleFilters(...names: readonly string[]): Promise<void> {
  await userEvent.click(filtersButton());
  const popup = await filtersPopup();
  for (const name of names) await userEvent.click(within(popup).getByRole("switch", { name }));
  await userEvent.keyboard("{Escape}");
}

/** Matches the element whose whole text is `text`, even when parts of it are buttons (a card's topic and channel). */
export const wholeLine =
  (text: string) =>
  (_: string, element: Element | null): boolean =>
    element?.textContent === text && [...element.children].every((child) => child.textContent !== text);
