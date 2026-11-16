import { useMemo, useState } from "react";
import { composeFeed } from "../domain/compose";
import { TOP_RANGE_HOURS } from "../domain/feed";
import { displayTitle } from "../domain/format";
import type { GlobalFilters, Feed, Video } from "../domain/types";
import type { View } from "../state/appState";
import { DescriptionPanel } from "./Description";
import { VideoCard } from "./VideoCard";

/** Cards per grid row; matches `.feed-grid` in index.css. */
const GRID_COLUMNS = 3;

type Props = Readonly<{
  catalog: readonly Video[];
  feed: Feed;
  filters: GlobalFilters;
  watched: readonly string[];
  view: View;
}>;

type Item = Readonly<{ kind: "card" | "panel"; video: Video }>;

/** Cards in order, with the open video's panel after the last card of its row. */
function withRowPanel(videos: readonly Video[], openId: string | null): readonly Item[] {
  const open = videos.findIndex((v) => v.id === openId);
  const cards = videos.map((video): Item => ({ kind: "card", video }));
  if (open < 0) return cards;
  const rowEnd = Math.min((Math.floor(open / GRID_COLUMNS) + 1) * GRID_COLUMNS, videos.length);
  return [...cards.slice(0, rowEnd), { kind: "panel", video: videos[open] }, ...cards.slice(rowEnd)];
}

export function FeedView({ catalog, feed, filters, watched, view }: Props) {
  const [openDescription, setOpenDescription] = useState<string | null>(null);
  const { upNext } = useMemo(
    () => composeFeed({ catalog, feed, filters, watched, topMaxAgeHours: TOP_RANGE_HOURS[feed.topRange] }),
    [catalog, feed, filters, watched],
  );
  const toggle = (id: string) => setOpenDescription((open) => (open === id ? null : id));
  const ranks = new Map(feed.kind === "top" ? upNext.map((v, i) => [v.id, i + 1] as const) : []);
  const items = withRowPanel(upNext, view === "grid" ? openDescription : null);

  return (
    <ul className={view === "grid" ? "feed-grid" : "feed-list"} aria-label="Up next">
      {items.map(({ kind, video }) =>
        kind === "panel" ? (
          <li key={`panel-${video.id}`} className="grid-panel-row">
            <DescriptionPanel video={video} title={displayTitle(video, filters)} onClose={() => setOpenDescription(null)} />
          </li>
        ) : (
          <VideoCard
            key={video.id}
            video={video}
            filters={filters}
            view={view}
            rank={ranks.get(video.id)}
            descriptionOpen={openDescription === video.id}
            onToggleDescription={() => toggle(video.id)}
          />
        ),
      )}
    </ul>
  );
}
