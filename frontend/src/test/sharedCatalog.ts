import type { Video } from "../domain/types";
import { CATALOG } from "./fixtures";

const video = (id: string, title: string, minutes: number): Video => ({
  id,
  title,
  honestTitle: title,
  channel: "Travel Desk",
  channelSubscribers: 500_000,
  topic: "Travel",
  minutes,
  views: 10_000,
  ageHours: 48,
  clickbait: false,
  live: false,
  newsCategory: null,
});

/** The test catalog plus every video the demo inbox's three shares name, so the inbox shows them all. */
export const SHARED_CATALOG: readonly Video[] = [
  ...CATALOG,
  video("demo-28", "Night trains across Japan", 25),
  video("demo-30", "Kyoto on a budget", 15),
  video("demo-25", "Packing light for two weeks", 10),
  video("demo-26", "Tokyo food alleys", 20),
  video("demo-22", "Build an MCP server", 30),
  video("demo-29", "Tools vs resources", 12),
  video("demo-21", "Prompt caching explained", 8),
  video("demo-6", "Derby highlights", 10),
  video("demo-8", "Five set final", 12),
  video("demo-9", "Cricket's best catches", 9),
];
