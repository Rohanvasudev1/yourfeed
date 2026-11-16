import type { Video } from "../domain/types";

const video = (o: Partial<Video> & Pick<Video, "id" | "title">): Video => ({
  honestTitle: o.title,
  channel: "Quiet Channel",
  channelSubscribers: 500_000,
  topic: "Gardening",
  minutes: 20,
  views: 10_000,
  ageHours: 48,
  clickbait: false,
  live: false,
  newsCategory: null,
  ...o,
});

/**
 * A catalog with something for every feed in the demo seed. Expected orders below are
 * worked out by hand from the seed's feed settings, not from the composition code.
 */
export const FEEDS_CATALOG: readonly Video[] = [
  video({ id: "demo-100", title: "Fresh agent build", topic: "AI", channel: "Agent Workshop", ageHours: 3, views: 2_000 }),
  video({ id: "demo-101", title: "Older ledger story", topic: "Economics", channel: "Ledger Files", ageHours: 100, views: 50_000 }),
  video({
    id: "demo-102",
    title: "Learning economics",
    topic: "Economics",
    channel: "Small Classroom",
    channelSubscribers: 20_000,
    ageHours: 400,
    views: 900_000,
  }),
  video({
    id: "demo-103",
    title: "Concert of the decade",
    topic: "Live music",
    channel: "Front Room Sessions",
    ageHours: 30_000,
    views: 22_000_000,
  }),
  video({ id: "demo-104", title: "Five set final", topic: "Tennis", channel: "Tennis Today", minutes: 15, ageHours: 20, views: 3_000_000 }),
  video({
    id: "demo-105",
    title: "Storm update",
    topic: "News",
    newsCategory: "World",
    channel: "World Desk",
    live: true,
    ageHours: 5,
    views: 76_000,
  }),
  video({ id: "demo-106", title: "Markets open", topic: "News", newsCategory: "Business", channel: "Money Desk", ageHours: 1, views: 30_000 }),
  video({ id: "demo-107", title: "Chip makers report", topic: "News", newsCategory: "Tech", channel: "Tech Desk", ageHours: 2, views: 10_000 }),
];

/** Followed channels only, newest first. */
export const SUBSCRIPTIONS_ORDER = ["Fresh agent build", "Older ledger story", "Concert of the decade"];

/** By views, within each range (24 hours, last year, all time). */
export const MOST_VIEWED_ORDER = {
  day: ["Five set final", "Storm update", "Markets open", "Chip makers report", "Fresh agent build"],
  year: ["Five set final", "Learning economics", "Storm update", "Older ledger story", "Markets open", "Chip makers report", "Fresh agent build"],
  all: [
    "Concert of the decade",
    "Five set final",
    "Learning economics",
    "Storm update",
    "Older ledger story",
    "Markets open",
    "Chip makers report",
    "Fresh agent build",
  ],
};

/** Live first, then newest first. */
export const NEWS_ORDER = ["Storm update", "Markets open", "Chip makers report"];
