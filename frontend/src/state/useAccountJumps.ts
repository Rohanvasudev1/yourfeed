import type { Dispatch } from "react";
import type { Feed, FeedKind } from "../domain/types";
import type { Action } from "./appState";
import type { TabControls } from "./useTabs";
import { SECTIONS, type SectionKey, type Sections } from "./useSections";

/** Where an account menu item leads: All tabs, a section at the bottom of the feed page, or a built-in feed. */
export type AccountJump = "all" | SectionKey | Extract<FeedKind, "shared" | "blend" | "claude">;

type Input = Readonly<{ feeds: readonly Feed[]; current: Feed; tabs: TabControls; sections: Sections; dispatch: Dispatch<Action> }>;

const isSection = (to: AccountJump): to is SectionKey => (SECTIONS as readonly string[]).includes(to);

/** Follows an account menu item, as the mockup's accountAction does. */
export function useAccountJumps({ feeds, current, tabs, sections, dispatch }: Input) {
  return (to: AccountJump) => {
    if (to === "all") return tabs.openAllTabs();
    if (isSection(to)) {
      // A draft page has no sections, so leaving it is part of the jump.
      if (current.draft) dispatch({ type: "leave_draft" });
      tabs.closeAllTabs();
      return sections.jump(to);
    }
    const feed = feeds.find((f) => f.kind === to);
    if (feed) tabs.open(feed.name);
  };
}
