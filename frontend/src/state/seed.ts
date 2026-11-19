import { makeFeed } from "../domain/feed";
import type { AppState } from "./appState";

/** The starting example, taken from the mockup (prototype/index.html) and re-keyed to demo-N ids. */
export const DEMO_SEED: AppState = {
  feeds: [
    makeFeed({ name: "Everything", kind: "home", color: 2 }),
    makeFeed({
      name: "Subscriptions",
      kind: "subs",
      color: 3,
      channels: [
        "Agent Workshop",
        "Byte Garden",
        "Ledger Files",
        "Matchday Highlights",
        "Court Replay",
        "Front Room Sessions",
        "Long Table Podcast",
      ],
    }),
    makeFeed({ name: "Most viewed", kind: "top", color: 4 }),
    makeFeed({ name: "News", kind: "news", color: 0 }),
    makeFeed({ name: "Learn", topics: ["AI", "Programming", "Economics", "Careers"], length: [10, 60], session: [30, 90], color: 0 }),
    makeFeed({ name: "Sport", topics: ["Premier League", "Tennis", "Cricket", "Wrestling"], length: [3, 20], session: [20, 60], color: 1 }),
    makeFeed({ name: "Wind down", topics: ["Podcasts", "Live music", "Vlogs"], length: [10, 120], session: [30, 150], color: 2, shelved: true }),
    makeFeed({ name: "Cooking", topics: ["Cooking"], length: [5, 30], session: [10, 60], color: 4, shelved: true }),
  ],
  currentFeed: "Everything",
  filters: {
    hideClickbait: true,
    honestTitles: true,
    hideViewCounts: true,
    hideSubscriberCounts: false,
    boostSmallCreators: true,
    includeShorts: false,
  },
  notes: {},
  folders: [
    { name: "Watch later", videoIds: ["demo-13", "demo-0", "demo-22"] },
    { name: "Weekend", videoIds: ["demo-11", "demo-15"] },
    { name: "Learning", videoIds: ["demo-2"] },
  ],
  watched: ["demo-6", "demo-13", "demo-0", "demo-8"],
  view: "grid",
  recentSearches: ["mcp server", "premier league highlights"],
  barMode: "edit",
};
