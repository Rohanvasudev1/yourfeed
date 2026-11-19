import { sharedVideos, type InboxShare } from "../../domain/inbox";
import type { GlobalFilters, Video } from "../../domain/types";
import type { SharedWithYou } from "../../state/useSharedWithYou";
import { SharedFeedHeader } from "./SharedFeedHeader";
import { SharedInbox } from "./SharedInbox";

type Props = Readonly<{ shared: SharedWithYou; shares: readonly InboxShare[]; byId: ReadonlyMap<string, Video>; filters: GlobalFilters }>;

/** What the Shared with you feed shows above its videos: the open share's header, or the inbox. */
export function SharedWithYouView({ shared, shares, byId, filters }: Props) {
  const { open } = shared;
  if (!open) return <SharedInbox shares={shares} byId={byId} filters={filters} onOpen={shared.openShare} onRemove={shared.remove} />;
  return (
    <SharedFeedHeader
      share={open}
      videos={sharedVideos(open, byId)}
      filters={filters}
      onBack={shared.back}
      onSave={() => shared.save(open.id)}
      onRemove={() => shared.remove(open.id)}
    />
  );
}
