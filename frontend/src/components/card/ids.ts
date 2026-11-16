import type { Video } from "../../domain/types";

/** The id of a card's Videos like this row, which its toggle controls. */
export const likeRowId = (video: Video) => `like-${video.id}`;
