import type { ReactNode } from "react";
import { filtersPhrase, hasItemList, topicsPhrase } from "../domain/feedList";
import type { Feed, GlobalFilters, Range } from "../domain/types";
import { usePopupController } from "./popup/usePopupController";
import { RangePopup } from "./RangePopup";
import { LENGTH_SETTING, SESSION_SETTING } from "./rangeSettings";
import { TopicsPopup, type TopicsPopupActions } from "./TopicsPopup";

export type RangeActions = Readonly<{
  onLength: (range: Range) => void;
  onSession: (range: Range) => void;
}>;

type Props = Readonly<{ feed: Feed; filters: GlobalFilters; topicActions: TopicsPopupActions; rangeActions: RangeActions }>;

type PopupKey = "topics" | "length" | "session";

const rangeText = ([min, max]: Range) => `${min}–${max} min`;

/** The sentence under the feed header that sums up the feed's settings; each phrase opens a popup that edits it. */
export function SettingsLine({ feed, filters, topicActions, rangeActions }: Props) {
  const popups = usePopupController<PopupKey>();

  /** A phrase that opens `popup` (rendered only while open) under it. */
  const phrase = (key: PopupKey, text: string, label: string | undefined, popup: () => ReactNode) => (
    <span className="popup-anchor">
      <button type="button" className="phrase" aria-label={label} {...popups.trigger(key)}>
        {text}
      </button>
      {popups.openKey === key && popup()}
    </span>
  );

  const topics = !hasItemList(feed) ? (
    <b>{topicsPhrase(feed)}</b>
  ) : (
    phrase("topics", topicsPhrase(feed), undefined, () => (
      <TopicsPopup feed={feed} popupProps={popups.popup("topics")} {...topicActions} />
    ))
  );
  const length = phrase("length", rangeText(feed.length), `${LENGTH_SETTING.label}, ${rangeText(feed.length)}`, () => (
    <RangePopup setting={LENGTH_SETTING} value={feed.length} onChange={rangeActions.onLength} popupProps={popups.popup("length")} />
  ));
  const session = phrase("session", rangeText(feed.session), `${SESSION_SETTING.label}, ${rangeText(feed.session)}`, () => (
    <RangePopup setting={SESSION_SETTING} value={feed.session} onChange={rangeActions.onSession} popupProps={popups.popup("session")} />
  ));
  return (
    <div className="settings-line" role="group" aria-label="Feed settings">
      Showing {topics} · {length} videos · {session} sessions · <b>{filtersPhrase(filters)}</b>
    </div>
  );
}
