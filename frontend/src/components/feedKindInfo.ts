import { IconAsterisk, IconFlame, IconHome, IconNews, IconUserCheck, IconUsers, type Icon } from "@tabler/icons-react";
import type { FeedKind } from "../domain/types";

type BuiltInKind = Exclude<FeedKind, "topics">;

/** The icon and one-line description each built-in feed kind shows in the tab bar and Explore. */
export const FEED_KIND_INFO: Readonly<Record<BuiltInKind, Readonly<{ icon: Icon; description: string }>>> = {
  home: { icon: IconHome, description: "Based on what you watch" },
  subs: { icon: IconUserCheck, description: "Newest from your channels" },
  top: { icon: IconFlame, description: "Ranked by views" },
  news: { icon: IconNews, description: "Latest from news channels" },
  claude: { icon: IconAsterisk, description: "From your Claude work" },
  blend: { icon: IconUsers, description: "Mixed with a friend" },
};

export const kindInfo = (kind: FeedKind) => (kind === "topics" ? null : FEED_KIND_INFO[kind]);
