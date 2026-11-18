import { displayTitle } from "../../domain/format";
import type { GlobalFilters, Video } from "../../domain/types";
import { Thumbnail } from "../thumbnail/Thumbnail";

type Props = Readonly<{
  videos: readonly Video[];
  /** Ids the visitor unticked; everything else is picked. */
  unticked: ReadonlySet<string>;
  filters: GlobalFilters;
  onChange: (unticked: ReadonlySet<string>) => void;
}>;

/** The Share panel's video list: a checkbox per video, a count, and Select all / Clear all. */
export function SharePicker({ videos, unticked, filters, onChange }: Props) {
  const pickedCount = videos.filter((v) => !unticked.has(v.id)).length;
  const allPicked = pickedCount === videos.length;
  const toggle = (id: string) =>
    onChange(new Set(unticked.has(id) ? [...unticked].filter((x) => x !== id) : [...unticked, id]));

  return (
    <>
      <div className="share-list-head">
        <span className="share-label">
          Videos · {pickedCount} of {videos.length} selected
        </span>
        <button type="button" className="link-button" onClick={() => onChange(new Set(allPicked ? videos.map((v) => v.id) : []))}>
          {allPicked ? "Clear all" : "Select all"}
        </button>
      </div>
      <ul className="share-list">
        {videos.map((video) => {
          const title = displayTitle(video, filters);
          const on = !unticked.has(video.id);
          return (
            <li key={video.id}>
              <label className={on ? "share-pick" : "share-pick off"}>
                <input type="checkbox" checked={on} aria-label={`Include ${title}`} onChange={() => toggle(video.id)} />
                <span className="share-thumb" aria-hidden="true">
                  <Thumbnail video={video} honest={filters.honestTitles} />
                </span>
                <span className="share-title">{title}</span>
                <span className="muted small">{video.minutes}m</span>
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );
}
