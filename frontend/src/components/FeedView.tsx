import { useState } from "react";
import { displayTitle } from "../domain/format";
import type { FeedKind, GlobalFilters, Video } from "../domain/types";
import type { View } from "../state/appState";
import type { CardActions } from "../state/useCardActions";
import type { SaveActions } from "../state/useLibrary";
import { LikeRow } from "./card/LikeRow";
import { DescriptionPanel } from "./Description";
import { usePopupController } from "./popup/usePopupController";
import { VideoCard } from "./VideoCard";

/** Cards per grid row; matches `.feed-grid` in index.css. */
const GRID_COLUMNS = 3;

type Props = Readonly<{
  /** Videos added to the session by hand; they come first and carry no rank. */
  pinned: readonly Video[];
  upNext: readonly Video[];
  kind: FeedKind;
  filters: GlobalFilters;
  view: View;
  onPlay: (video: Video) => void;
  saveActions: SaveActions;
  cardActions: CardActions;
}>;

/** The one card panel open at a time: its description (grid only; the list shows it inline) or Videos like this. */
type PanelKind = "description" | "like";
type OpenPanel = Readonly<{ id: string; panel: PanelKind }> | null;

type Item = Readonly<{ kind: "card" | "panel"; video: Video }>;

/** Cards in order, with the open panel after the last card of its row (every card is a row in the list). */
function withRowPanel(videos: readonly Video[], open: OpenPanel, columns: number): readonly Item[] {
  const at = videos.findIndex((v) => v.id === open?.id);
  const cards = videos.map((video): Item => ({ kind: "card", video }));
  if (at < 0) return cards;
  const rowEnd = Math.min((Math.floor(at / columns) + 1) * columns, videos.length);
  return [...cards.slice(0, rowEnd), { kind: "panel", video: videos[at] }, ...cards.slice(rowEnd)];
}

export function FeedView({ pinned, upNext, kind, filters, view, onPlay, saveActions, cardActions }: Props) {
  const [open, setOpen] = useState<OpenPanel>(null);
  const popups = usePopupController<string>();
  const toggle = (id: string, panel: PanelKind) => setOpen((o) => (o?.id === id && o.panel === panel ? null : { id, panel }));
  const ranks = new Map(kind === "top" ? upNext.map((v, i) => [v.id, i + 1] as const) : []);
  const panelInRow = view === "grid" || open?.panel === "like" ? open : null;
  const items = withRowPanel([...pinned, ...upNext], panelInRow, view === "grid" ? GRID_COLUMNS : 1);
  const isOpen = (id: string, panel: PanelKind) => open?.id === id && open.panel === panel;

  return (
    <ul className={view === "grid" ? "feed-grid" : "feed-list"} aria-label="Up next">
      {items.map(({ kind, video }) =>
        kind === "panel" ? (
          <li key={`panel-${video.id}`} className="grid-panel-row">
            {open?.panel === "like" ? (
              <div className="grid-panel like-panel">
                <LikeRow video={video} title={displayTitle(video, filters)} filters={filters} actions={cardActions} onPlay={onPlay} />
              </div>
            ) : (
              <DescriptionPanel video={video} title={displayTitle(video, filters)} onClose={() => setOpen(null)} />
            )}
          </li>
        ) : (
          <VideoCard
            key={video.id}
            video={video}
            filters={filters}
            view={view}
            rank={ranks.get(video.id)}
            descriptionOpen={isOpen(video.id, "description")}
            onToggleDescription={() => toggle(video.id, "description")}
            likeOpen={isOpen(video.id, "like")}
            onToggleLike={() => toggle(video.id, "like")}
            onPlay={() => onPlay(video)}
            saveActions={saveActions}
            actions={cardActions}
            popups={popups}
          />
        ),
      )}
    </ul>
  );
}
