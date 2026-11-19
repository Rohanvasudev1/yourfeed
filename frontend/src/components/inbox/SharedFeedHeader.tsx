import { IconArrowLeft, IconPlaylistAdd, IconTrash } from "@tabler/icons-react";
import { displayTitle } from "../../domain/format";
import { senderName, type InboxShare } from "../../domain/inbox";
import type { GlobalFilters, Video } from "../../domain/types";
import { SenderAvatar, ShareMeta } from "./shareParts";
import "./inbox.css";

type Props = Readonly<{
  share: InboxShare;
  videos: readonly Video[];
  filters: GlobalFilters;
  onBack: () => void;
  onSave: () => void;
  onRemove: () => void;
}>;

/** An open share's header: back to the inbox, who sent it, Save as my feed, remove, their message and their notes. */
export function SharedFeedHeader({ share, videos, filters, onBack, onSave, onRemove }: Props) {
  const sender = senderName(share);
  const notesLabel = share.from === null ? "Notes in the link" : `${sender}'s notes`;
  const notes = videos.flatMap((video) => {
    const note = share.notes[video.id];
    return note ? [{ video, note }] : [];
  });
  return (
    <section className="shared-header" aria-label="Shared feed">
      <div className="shared-header-row">
        <button type="button" className="icon-button" aria-label="Back to everything shared with you" title="All shared" onClick={onBack}>
          <IconArrowLeft size={17} aria-hidden="true" />
        </button>
        <SenderAvatar share={share} size={28} />
        <div className="shared-header-text">
          <p className="shared-header-title">
            {share.title} <span className="shared-header-from">from {sender}</span>
          </p>
          <p className="muted">
            <ShareMeta share={share} videos={videos} />
          </p>
        </div>
        <button type="button" className="text-button" onClick={onSave}>
          <IconPlaylistAdd size={16} aria-hidden="true" />
          Save as my feed
        </button>
        <button type="button" className="icon-button" aria-label="Remove this shared feed" title="Remove" onClick={onRemove}>
          <IconTrash size={16} aria-hidden="true" />
        </button>
      </div>
      {share.message && <p className="share-message">“{share.message}”</p>}
      {notes.length > 0 && (
        <div className="shared-notes">
          <p className="share-label">{notesLabel}</p>
          <ul aria-label={notesLabel}>
            {notes.map(({ video, note }) => (
              <li key={video.id}>
                <b>{displayTitle(video, filters)}:</b> {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
