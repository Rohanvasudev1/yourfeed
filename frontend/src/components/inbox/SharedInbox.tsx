import { IconInbox, IconX } from "@tabler/icons-react";
import { senderName, sharedVideos, type InboxShare } from "../../domain/inbox";
import type { GlobalFilters, Video } from "../../domain/types";
import { Thumbnail } from "../thumbnail/Thumbnail";
import { displayTitle } from "../../domain/format";
import { SenderAvatar, ShareMeta } from "./shareParts";
import "./inbox.css";

/** Thumbnails a card shows, as in the mockup. */
const STRIP_LENGTH = 4;

type Props = Readonly<{
  shares: readonly InboxShare[];
  byId: ReadonlyMap<string, Video>;
  filters: GlobalFilters;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}>;

/** The Shared with you inbox: one card per share, newest first, or a note when there are none. */
export function SharedInbox({ shares, byId, filters, onOpen, onRemove }: Props) {
  if (shares.length === 0) {
    return (
      <div className="inbox-empty">
        <IconInbox size={26} aria-hidden="true" />
        <p className="inbox-empty-title">Nothing shared with you yet</p>
        <p className="muted">When someone sends you a feed, it shows up here.</p>
      </div>
    );
  }
  return (
    <>
      <p className="inbox-hint muted">Feeds people have sent you. Open one to watch it here, or save it as your own feed.</p>
      <ul className="inbox" aria-label="Shared with you">
        {shares.map((share) => (
          <ShareCard key={share.id} share={share} videos={sharedVideos(share, byId)} filters={filters} onOpen={onOpen} onRemove={onRemove} />
        ))}
      </ul>
    </>
  );
}

type CardProps = Readonly<{
  share: InboxShare;
  videos: readonly Video[];
  filters: GlobalFilters;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}>;

function ShareCard({ share, videos, filters, onOpen, onRemove }: CardProps) {
  const sender = senderName(share);
  return (
    <li className={share.unread ? "share-card unread" : "share-card"}>
      <SenderAvatar share={share} size={36} />
      <div className="share-card-body">
        <p className="share-card-line">
          {/* The button stretches over the whole card, so clicking anywhere opens it. */}
          <button type="button" className="share-card-open" aria-label={`Open ${share.title} from ${sender}${share.unread ? ", new" : ""}`} onClick={() => onOpen(share.id)}>
            {share.from === null ? "A link shared " : <><b>{sender}</b> shared </>}
            <b>{share.title}</b>
          </button>
          {share.unread && <span className="new-dot" role="img" aria-label="New" />}
        </p>
        <p className="share-card-meta muted">
          <ShareMeta share={share} videos={videos} />
          {Object.keys(share.notes).length > 0 && " · includes their notes"}
        </p>
        {share.message && <p className="share-message">“{share.message}”</p>}
        <div className="share-strip">
          {videos.slice(0, STRIP_LENGTH).map((video) => (
            <span key={video.id} role="img" aria-label={`Thumbnail: ${displayTitle(video, filters)}`}>
              <Thumbnail video={video} honest={filters.honestTitles} />
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="icon-button share-card-remove"
        aria-label={`Remove ${share.title} from ${sender}`}
        title="Remove"
        onClick={() => onRemove(share.id)}
      >
        <IconX size={16} aria-hidden="true" />
      </button>
    </li>
  );
}
