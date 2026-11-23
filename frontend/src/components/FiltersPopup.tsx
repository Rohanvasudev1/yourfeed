import { useId, type HTMLAttributes, type RefCallback } from "react";
import { filterApplies } from "../domain/feedList";
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

const DEMO_ONLY_TEXT = "Demo catalog only";

type Props = Readonly<{
  filters: GlobalFilters;
  /** Signed in, on your YouTube: filters that need the demo's AI tags are shown off and can't be switched. */
  realCatalog: boolean;
  onToggle: (filter: keyof GlobalFilters) => void;
  popupProps: HTMLAttributes<HTMLElement> & { ref: RefCallback<HTMLElement> };
}>;

/** Switches for the global filters. Each flip applies at once, so the feed changes behind the open popup. */
export function FiltersPopup({ filters, realCatalog, onToggle, popupProps }: Props) {
  const labelId = useId();
  const demoOnlyId = useId();
  return (
    <div {...popupProps} className="popup filters-popup" aria-labelledby={labelId}>
      <p className="popup-label" id={labelId}>
        Filters and display
      </p>
      {FILTERS.map(([key, label]) => {
        const applies = filterApplies(key, realCatalog);
        // aria-disabled, not disabled: the switch stays reachable by keyboard so its reason is read out.
        return (
          <button
            key={key}
            type="button"
            role="switch"
            aria-checked={applies && filters[key]}
            // The note is read as the description, so the name stays the filter's.
            aria-label={applies ? undefined : label}
            aria-disabled={applies ? undefined : true}
            aria-describedby={applies ? undefined : `${demoOnlyId}-${key}`}
            className="toggle"
            onClick={applies ? () => onToggle(key) : undefined}
          >
            <span className="toggle-text">
              {label}
              {!applies && (
                <span className="toggle-note" id={`${demoOnlyId}-${key}`}>
                  {DEMO_ONLY_TEXT}
                </span>
              )}
            </span>
            <span className="switch" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
