import { IconDots } from "@tabler/icons-react";
import { filtersPhrase, hasItemList, topicsPhrase } from "../domain/feedList";
import type { Feed, GlobalFilters } from "../domain/types";
import { usePopupController } from "./popup/usePopupController";
import { TabOptionsPopup, type TabOptions } from "./TabOptionsPopup";
import { TopicsPopup, type TopicsPopupActions } from "./TopicsPopup";

type Props = Readonly<{ feed: Feed; filters: GlobalFilters; topicActions: TopicsPopupActions; tabOptions: TabOptions }>;

type PopupKey = "topics" | "tab-options";

/** The sentence under the feed header that sums up the feed's settings; each phrase opens a popup that edits it. */
export function SettingsLine({ feed, filters, topicActions, tabOptions }: Props) {
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
      <b>{filtersPhrase(filters)}</b>{" "}
      <span className="popup-anchor">
        <button type="button" className="phrase phrase-icon" aria-label="Tab options" title="Tab options" {...popups.trigger("tab-options")}>
          <IconDots size={16} aria-hidden="true" />
        </button>
        {popups.openKey === "tab-options" && <TabOptionsPopup feed={feed} options={tabOptions} popupProps={popups.popup("tab-options")} />}
      </span>
    </div>
  );
}
