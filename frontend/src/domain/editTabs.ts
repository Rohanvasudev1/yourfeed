import { isBuiltIn } from "./feed";
import { barSpaces, canShelve, MAX_BAR_SPACES, type TabAction } from "./tabs";
import type { Feed } from "./types";

/** What edit mode can do to every selected tab at once. */
export type BulkAction = "shelve" | "show" | "delete";

export const NOTHING_SELECTED = "Select at least one tab first.";

const pickFeeds = (feeds: readonly Feed[], names: readonly string[]): readonly Feed[] =>
  names.flatMap((name) => feeds.find((f) => f.name === name) ?? []);

function deleteProblem(feeds: readonly Feed[], picked: readonly Feed[]): string | null {
  const builtIn = picked.filter(isBuiltIn);
  if (builtIn.length) {
    const them = builtIn.length > 1 ? "them" : "it";
    return `${builtIn.map((f) => f.name).join(", ")} can't be deleted. You can move ${them} to All tabs instead.`;
  }
  return picked.length >= feeds.length ? "Keep at least one feed." : null;
}

function shelveProblem(picked: readonly Feed[]): string | null {
  const stays = picked.find((f) => !canShelve(f));
  return stays ? `${stays.name} always stays in the tab bar.` : null;
}

function showProblem(feeds: readonly Feed[], selected: readonly string[]): string | null {
  const shown = feeds.map((f) => (selected.includes(f.name) ? { ...f, shelved: false } : f));
  return barSpaces(shown) > MAX_BAR_SPACES ? `The tab bar holds ${MAX_BAR_SPACES} tabs. Move some to All tabs first.` : null;
}

/** Why `action` can't run on the selected tabs (named in the order they were selected), or null when it can. */
export function bulkProblem(feeds: readonly Feed[], selected: readonly string[], action: BulkAction): string | null {
  const picked = pickFeeds(feeds, selected);
  if (!picked.length) return NOTHING_SELECTED;
  switch (action) {
    case "delete":
      return deleteProblem(feeds, picked);
    case "shelve":
      return shelveProblem(picked);
    case "show":
      return showProblem(feeds, selected);
  }
}

/** The single-tab actions that carry out `action` on every selected tab, once `bulkProblem` allows it. */
export function bulkTabActions(selected: readonly string[], action: BulkAction): readonly TabAction[] {
  return selected.map((feed) =>
    action === "delete" ? { type: "delete_feed", feed } : { type: "set_shelved", feed, shelved: action === "shelve" },
  );
}
