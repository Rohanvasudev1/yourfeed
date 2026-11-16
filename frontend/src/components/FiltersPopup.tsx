import { useId, type HTMLAttributes, type RefCallback } from "react";
import type { GlobalFilters } from "../domain/types";

/** Switch labels for every global filter, in the order the popup lists them. A Record, so a new filter can't be left out. */
const FILTER_LABELS: Readonly<Record<keyof GlobalFilters, string>> = {
  hideClickbait: "Hide clickbait",
  honestTitles: "Honest titles",
  hideViewCounts: "Hide view counts",
  hideSubscriberCounts: "Hide subscriber counts",
  boostSmallCreators: "Boost small creators",
  includeShorts: "Include Shorts",
};
const FILTERS = Object.entries(FILTER_LABELS) as [keyof GlobalFilters, string][];

type Props = Readonly<{
  filters: GlobalFilters;
  onToggle: (filter: keyof GlobalFilters) => void;
  popupProps: HTMLAttributes<HTMLElement> & { ref: RefCallback<HTMLElement> };
}>;

/** Switches for the global filters. Each flip applies at once, so the feed changes behind the open popup. */
export function FiltersPopup({ filters, onToggle, popupProps }: Props) {
  const labelId = useId();
  return (
    <div {...popupProps} className="popup filters-popup" aria-labelledby={labelId}>
      <p className="popup-label" id={labelId}>
        Filters and display
      </p>
      {FILTERS.map(([key, label]) => (
        <button key={key} type="button" role="switch" aria-checked={filters[key]} className="toggle" onClick={() => onToggle(key)}>
          {label}
          <span className="switch" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
