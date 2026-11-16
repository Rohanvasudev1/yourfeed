import { filtersPhrase, hasItemList, topicsPhrase } from "../domain/feedList";
import type { Feed, GlobalFilters } from "../domain/types";
import { FiltersPopup } from "./FiltersPopup";
import { usePopupController } from "./popup/usePopupController";
import { TopicsPopup, type TopicsPopupActions } from "./TopicsPopup";

type Props = Readonly<{
  feed: Feed;
  filters: GlobalFilters;
  topicActions: TopicsPopupActions;
  onToggleFilter: (filter: keyof GlobalFilters) => void;
}>;

type PopupKey = "topics" | "filters";

/** The sentence under the feed header that sums up the feed's settings; each phrase opens a popup that edits it. */
export function SettingsLine({ feed, filters, topicActions, onToggleFilter }: Props) {
  const popups = usePopupController<PopupKey>();
  const [minLen, maxLen] = feed.length;
  const [minSes, maxSes] = feed.session;
  const topics = !hasItemList(feed) ? (
    <b>{topicsPhrase(feed)}</b>
  ) : (
      <span className="popup-anchor">
        <button type="button" className="phrase" {...popups.trigger("topics")}>
          {topicsPhrase(feed)}
        </button>
        {popups.openKey === "topics" && <TopicsPopup feed={feed} popupProps={popups.popup("topics")} {...topicActions} />}
      </span>
    );
  return (
    <div className="settings-line" role="group" aria-label="Feed settings">
      Showing {topics} · <b>{`${minLen}–${maxLen} min`}</b> videos · <b>{`${minSes}–${maxSes} min`}</b> sessions ·{" "}
      <span className="popup-anchor">
        <button type="button" className="phrase" {...popups.trigger("filters")}>
          {filtersPhrase(filters)}
        </button>
        {popups.openKey === "filters" && <FiltersPopup filters={filters} onToggle={onToggleFilter} popupProps={popups.popup("filters")} />}
      </span>
    </div>
  );
}
