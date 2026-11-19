import { myTopics, tasteOf } from "../domain/blend";
import { makeFeed } from "../domain/feed";
import type { Feed } from "../domain/types";
import type { AppState } from "./appState";

/** The demo catalog's topics, which the mockup's example blends take their taste from. */
const DEMO_TOPICS = [
  "AI",
  "Programming",
  "Careers",
  "Economics",
  "Premier League",
  "Tennis",
  "Cricket",
  "Wrestling",
  "Podcasts",
  "Live music",
  "Vlogs",
  "MCP",
  "Product design",
  "Cooking",
  "Travel",
  "News",
];
const DEMO_BLENDS = ["maya.k", "devon_r"];

const DEMO_FEEDS: readonly Feed[] = [
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
    makeFeed({ name: "From Claude", kind: "claude", length: [5, 60], session: [20, 90], color: 5 }),
    makeFeed({ name: "Blend", kind: "blend", length: [5, 60], session: [20, 120], color: 3 }),
    makeFeed({ name: "Learn", topics: ["AI", "Programming", "Economics", "Careers"], length: [10, 60], session: [30, 90], color: 0 }),
    makeFeed({ name: "Sport", topics: ["Premier League", "Tennis", "Cricket", "Wrestling"], length: [3, 20], session: [20, 60], color: 1 }),
    makeFeed({ name: "Wind down", topics: ["Podcasts", "Live music", "Vlogs"], length: [10, 120], session: [30, 150], color: 2, shelved: true }),
    makeFeed({ name: "Cooking", topics: ["Cooking"], length: [5, 30], session: [10, 60], color: 4, shelved: true }),
];

/** The starting example, taken from the mockup (prototype/index.html) and re-keyed to demo-N ids. */
export const DEMO_SEED: AppState = {
  feeds: DEMO_FEEDS,
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
  blends: DEMO_BLENDS.map((name) => tasteOf(name, myTopics(DEMO_FEEDS), DEMO_TOPICS)),
};
