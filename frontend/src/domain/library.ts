/** Saved folders and watch history: the visitor's own library, kept across feeds. */

export type SavedFolder = Readonly<{ name: string; videoIds: readonly string[] }>;

const without = (ids: readonly string[], id: string) => ids.filter((x) => x !== id);

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const findFolder = (folders: readonly SavedFolder[], name: string): SavedFolder | undefined =>
  folders.find((f) => f.name === name);

/** Adds `id` to the end of the folder. A video already there, or a folder that doesn't exist, changes nothing. */
export const saveToFolder = (folders: readonly SavedFolder[], name: string, id: string): readonly SavedFolder[] =>
  folders.map((f) => (f.name === name && !f.videoIds.includes(id) ? { ...f, videoIds: [...f.videoIds, id] } : f));

export const removeFromFolder = (folders: readonly SavedFolder[], name: string, id: string): readonly SavedFolder[] =>
  folders.map((f) => (f.name === name ? { ...f, videoIds: without(f.videoIds, id) } : f));

/** Why `name` can't be a new folder's name, or null when it can. */
export function folderNameError(folders: readonly SavedFolder[], name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name the folder first";
  if (folders.some((f) => sameName(f.name, trimmed))) return "You already have a folder with that name";
  return null;
}

/** Appends a folder named `name` (trimmed), optionally holding one video. An invalid name changes nothing. */
export function createFolder(folders: readonly SavedFolder[], name: string, firstVideo?: string): readonly SavedFolder[] {
  if (folderNameError(folders, name)) return folders;
  return [...folders, { name: name.trim(), videoIds: firstVideo === undefined ? [] : [firstVideo] }];
}

export const isSaved = (folders: readonly SavedFolder[], id: string): boolean => folders.some((f) => f.videoIds.includes(id));

/** Watch history is oldest first; watching a video again moves it to the end. */
export const recordWatch = (history: readonly string[], id: string): readonly string[] => [...without(history, id), id];

export const forgetWatch = (history: readonly string[], id: string): readonly string[] => without(history, id);
