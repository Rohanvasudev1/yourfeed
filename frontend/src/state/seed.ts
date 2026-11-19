import { makeFeed } from "../domain/feed";
import type { InboxShare } from "../domain/inbox";
import type { AppState } from "./appState";

const HOUR_MS = 3_600_000;
const hoursAgo = (hours: number) => Date.now() - hours * HOUR_MS;

/** The mockup's demo inbox: feeds other people "sent", re-keyed to demo-N ids. */
const DEMO_INBOX: readonly InboxShare[] = [
  {
    id: "demo-share-1",
    from: "maya.k",
    title: "Trip planning",
    videos: ["demo-28", "demo-30", "demo-25", "demo-26"],
    message: "For your Japan trip, the night trains one is great",
    notes: {},
    received: hoursAgo(2),
    unread: true,
  },
  {
    id: "demo-share-2",
    from: "devon_r",
    title: "Learn",
    videos: ["demo-22", "demo-29", "demo-0", "demo-21"],
    message: "The MCP ones are worth it",
    notes: { "demo-22": "Skip to 6:00 for the actual server code", "demo-29": "Good explanation of tools vs resources" },
    received: hoursAgo(24),
    unread: true,
  },
  {
    id: "demo-share-3",
    from: "sam_k",
    title: "Sport",
    videos: ["demo-6", "demo-8", "demo-9"],
    message: "",
    notes: {},
    received: hoursAgo(72),
    unread: false,
  },
];

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
    makeFeed({ name: "Shared with you", kind: "shared", color: 2 }),
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
  inbox: { shares: DEMO_INBOX, open: null, last: null },
};
