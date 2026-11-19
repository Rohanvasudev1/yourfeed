import { IconLink } from "@tabler/icons-react";
import { minutesText, videoCount } from "../../domain/format";
import { receivedAgo, type InboxShare } from "../../domain/inbox";
import type { Video } from "../../domain/types";

/** The sender's initial in a circle, or a link icon for a share opened from a link. */
export function SenderAvatar({ share, size }: Readonly<{ share: InboxShare; size: number }>) {
  return (
    <span className="sender-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {share.from === null ? <IconLink size={size / 2} /> : share.from.charAt(0).toUpperCase()}
    </span>
  );
}

/** "4 videos · 1h 10m · 2 hours ago". */
export function ShareMeta({ share, videos }: Readonly<{ share: InboxShare; videos: readonly Video[] }>) {
  const minutes = videos.reduce((sum, v) => sum + v.minutes, 0);
  return <>{`${videoCount(videos.length)} · ${minutesText(minutes)} · ${receivedAgo(share, Date.now())}`}</>;
}
