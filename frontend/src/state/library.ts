import { createFolder, forgetWatch, removeFromFolder, saveToFolder } from "../domain/library";
import type { AppState } from "./appState";

/** Changes to saved folders and watch history. */
export type LibraryAction =
  | Readonly<{ type: "save_to_folder"; folder: string; video: string }>
  /** Makes a folder; an invalid or repeated name changes nothing. */
  | Readonly<{ type: "create_folder"; name: string; video?: string }>
  | Readonly<{ type: "remove_from_folder"; folder: string; video: string }>
  | Readonly<{ type: "forget_watch"; video: string }>
  | Readonly<{ type: "clear_history" }>;

export function reduceLibrary(state: AppState, action: LibraryAction): AppState {
  switch (action.type) {
    case "save_to_folder":
      return { ...state, folders: saveToFolder(state.folders, action.folder, action.video) };
    case "create_folder":
      return { ...state, folders: createFolder(state.folders, action.name, action.video) };
    case "remove_from_folder":
      return { ...state, folders: removeFromFolder(state.folders, action.folder, action.video) };
    case "forget_watch":
      return { ...state, watched: forgetWatch(state.watched, action.video) };
    case "clear_history":
      return { ...state, watched: [] };
  }
}
