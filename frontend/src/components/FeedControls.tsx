import { NEWS_CATEGORIES, TOP_RANGES, type Feed, type NewsCategory, type TopRange } from "../domain/types";

const TOP_RANGE_LABELS: Readonly<Record<TopRange, string>> = {
  day: "Last 24 hours",
  year: "Last year",
  all: "All time",
};

type Props = Readonly<{
  feed: Feed;
  onTopRange: (range: TopRange) => void;
  onNewsCategory: (category: NewsCategory) => void;
}>;

/** The per-kind controls above Up next: Most viewed's time range and News's categories. */
export function FeedControls({ feed, onTopRange, onNewsCategory }: Props) {
  switch (feed.kind) {
    case "top":
      return (
        <div className="feed-controls">
          <Segmented label="Time range" options={TOP_RANGES} labels={TOP_RANGE_LABELS} value={feed.topRange} onChange={onTopRange} />
        </div>
      );
    case "news":
      return (
        <div className="feed-controls">
          <Segmented label="News category" options={NEWS_CATEGORIES} value={feed.newsCategory} onChange={onNewsCategory} />
          <span className="muted small">Newest first. Live coverage is pinned to the top.</span>
        </div>
      );
    default:
      return null;
  }
}

type SegmentedProps<T extends string> = Readonly<{
  label: string;
  options: readonly T[];
  labels?: Readonly<Record<T, string>>;
  value: T;
  onChange: (value: T) => void;
}>;

/** A row of toggle buttons where exactly one is pressed. */
function Segmented<T extends string>({ label, options, labels, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>
          {labels?.[option] ?? option}
        </button>
      ))}
    </div>
  );
}
