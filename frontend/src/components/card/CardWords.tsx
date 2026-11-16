import { IconEye, IconEyeOff, IconMinus, IconPlus, IconUserMinus, IconUserPlus, type Icon } from "@tabler/icons-react";
import { useId, type ReactNode } from "react";
import { hasItemList } from "../../domain/feedList";
import { compactCount } from "../../domain/format";
import type { CardActions, TopicStanding } from "../../state/useCardActions";
import type { PopupController } from "../popup/usePopupController";
import "./card.css";

type WordProps = Readonly<{ value: string; actions: CardActions; popups: PopupController<string>; popupKey: string }>;

type Choice = Readonly<{ label: string; icon: Icon; run: () => void }>;

const videoCount = (n: number) => `${n} video${n === 1 ? "" : "s"}`;

/** A topic or channel name on a card that opens its quick actions, using the shared popup controller. */
function Word({ kind, value, popups, popupKey, status, choices }: WordProps & Readonly<{ kind: "Topic" | "Channel"; status: string; choices: readonly Choice[] }>) {
  const headingId = useId();
  return (
    <span className="popup-anchor">
      <button type="button" className="word" aria-label={`${kind}: ${value}`} {...popups.trigger(popupKey)}>
        {value}
      </button>
      {popups.openKey === popupKey && (
        <div {...popups.popup(popupKey)} className="popup word-popup" aria-labelledby={headingId}>
          <p className="word-popup-heading" id={headingId}>
            {value}
          </p>
          <p className="popup-label">{status}</p>
          {choices.map(({ label, icon: ChoiceIcon, run }) => (
            <button
              key={label}
              type="button"
              className="popup-action"
              onClick={() => {
                run();
                popups.finish();
              }}
            >
              <ChoiceIcon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function topicStatus({ feed, listed, muted, count }: TopicStanding): string {
  const where = muted
    ? "Hidden from this tab"
    : listed
      ? feed.kind === "home"
        ? "Boosted in this tab"
        : "One of this tab's topics"
      : "Not one of this tab's topics";
  return `${where} · ${videoCount(count)}`;
}

function topicChoices(topic: string, standing: TopicStanding, actions: CardActions): readonly Choice[] {
  if (standing.muted) return [{ label: `Show ${topic} again`, icon: IconEye, run: () => actions.showTopic(topic) }];
  const home = standing.feed.kind === "home";
  const listChoice: Choice = standing.listed
    ? { label: home ? `Stop boosting ${topic}` : `Remove from ${standing.feed.name}`, icon: IconMinus, run: () => actions.removeTopic(topic) }
    : { label: home ? `Boost ${topic}` : `Add to ${standing.feed.name}`, icon: IconPlus, run: () => actions.addTopic(topic) };
  const hide: Choice = { label: `Hide ${topic} here`, icon: IconEyeOff, run: () => actions.hideTopic(topic) };
  return standing.editable ? [listChoice, hide] : [hide];
}

/** A card's topic: Add to / Remove from this feed (Boost on Everything), Hide here, Show again. Plain text on News, whose only topic is News. */
export function TopicWord(props: WordProps): ReactNode {
  const { value, actions } = props;
  const standing = actions.topic(value);
  if (!hasItemList(standing.feed)) return value;
  return <Word kind="Topic" status={topicStatus(standing)} choices={topicChoices(value, standing, actions)} {...props} />;
}

/** A card's channel: Add to / Remove from Subscriptions. */
export function ChannelWord(props: WordProps & Readonly<{ hideSubscriberCounts: boolean }>) {
  const { value, actions, hideSubscriberCounts } = props;
  const { subscribers, count, followed } = actions.channel(value);
  const status = [
    ...(hideSubscriberCounts ? [] : [`${compactCount(subscribers)} subscribers`]),
    `${videoCount(count)} here`,
    ...(followed ? ["You follow this channel"] : []),
  ].join(" · ");
  const choice: Choice = followed
    ? { label: "Remove from Subscriptions", icon: IconUserMinus, run: () => actions.setFollowed(value, false) }
    : { label: "Add to Subscriptions", icon: IconUserPlus, run: () => actions.setFollowed(value, true) };
  return <Word kind="Channel" status={status} choices={[choice]} {...props} />;
}
