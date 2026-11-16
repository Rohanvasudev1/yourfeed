import type { Dispatch } from "react";
import { findFolder, folderNameError, isSaved } from "../domain/library";
import { isInSession } from "../domain/session";
import type { Feed, Video } from "../domain/types";
import type { Action, AppState } from "./appState";

export type ResolvedFolder = Readonly<{ name: string; videos: readonly Video[] }>;

/** What a card's Save control needs. Each save returns a message to show, or null when it worked. */
export type SaveActions = Readonly<{
  folderNames: readonly string[];
  isSaved: (video: Video) => boolean;
  save: (video: Video, folder: string) => string | null;
  /** Makes a folder named `name`, holding `video` when given. */
  createFolder: (name: string, video?: Video) => string | null;
}>;

const resolve = (ids: readonly string[], byId: ReadonlyMap<string, Video>) => ids.flatMap((id) => byId.get(id) ?? []);

/** Saved folders and watch history, as videos, and what the visitor can do with them. */
export function useLibrary(state: AppState, feed: Feed, byId: ReadonlyMap<string, Video>, dispatch: Dispatch<Action>) {
  const folders: readonly ResolvedFolder[] = state.folders.map((f) => ({ name: f.name, videos: resolve(f.videoIds, byId) }));
  const history = resolve(state.watched, byId).reverse();

  const createFolder = (name: string, video?: Video): string | null => {
    const error = folderNameError(state.folders, name);
    if (!error) dispatch({ type: "create_folder", name, video: video?.id });
    return error;
  };

  const saveActions: SaveActions = {
    folderNames: state.folders.map((f) => f.name),
    isSaved: (video) => isSaved(state.folders, video.id),
    save: (video, folder) => {
      if (findFolder(state.folders, folder)?.videoIds.includes(video.id)) return `Already in ${folder}.`;
      dispatch({ type: "save_to_folder", folder, video: video.id });
      return null;
    },
    createFolder,
  };

  return {
    folders,
    history,
    saveActions,
    createFolder,
    removeFromFolder: (folder: string, video: Video) => dispatch({ type: "remove_from_folder", folder, video: video.id }),
    forgetWatch: (video: Video) => dispatch({ type: "forget_watch", video: video.id }),
    clearHistory: () => dispatch({ type: "clear_history" }),
    pin: (video: Video) => dispatch({ type: "pin_video", feed: feed.name, video: video.id }),
    inSession: (video: Video) => isInSession(feed, video.id),
  };
}

export type Library = ReturnType<typeof useLibrary>;
