import type { Dispatch } from "react";
import { youtubeSearchUrl } from "../domain/session";
import type { Feed, Video } from "../domain/types";
import type { Action } from "./appState";
import { useReturnNudge } from "./useReturnNudge";
import { useTimedValue } from "./useTimedValue";

const FLASH_MS = 5000;
const POPUP_BLOCKED = "Your browser blocked the YouTube tab. Allow pop-ups for this page to open videos.";

/** The open feed's session (Watching now and Finished) and what the visitor can do with it. */
export function useSession(feed: Feed, byId: ReadonlyMap<string, Video>, dispatch: Dispatch<Action>) {
  const current = feed.current === null ? undefined : byId.get(feed.current);
  const finished = feed.finished.flatMap((id) => byId.get(id) ?? []);
  const nudge = useReturnNudge(current ? `${feed.name}\n${current.id}` : null);
  const [flash, showFlash] = useTimedValue<string>(FLASH_MS);

  const play = (video: Video) => {
    if (!window.open(youtubeSearchUrl(video), "_blank", "noopener")) showFlash(POPUP_BLOCKED);
    dispatch({ type: "watch_video", feed: feed.name, video: video.id });
  };
  const finish = () => dispatch({ type: "finish_current", feed: feed.name });
  const moveBack = (video: Video) => dispatch({ type: "move_back_to_up_next", feed: feed.name, video: video.id });

  return { current, finished, nudge, flash, showFlash, play, finish, moveBack };
}
