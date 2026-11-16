import { IconEye, IconEyeOff, IconPlus, IconX } from "@tabler/icons-react";
import { useId, useRef, useState, type FormEvent, type HTMLAttributes, type RefCallback } from "react";
import { activeItems, includesIgnoringCase, listKeyOf, normaliseItem, type ListedFeed, type ListedKind } from "../domain/feedList";
import type { Feed } from "../domain/types";

const LABELS: Readonly<Record<ListedKind, string>> = {
  subs: "Channels in this feed",
  top: "Limit to topics",
  home: "Boost topics",
  claude: "Topics in this feed",
  topics: "Topics in this feed",
};

const EMPTY: Readonly<Record<ListedKind, string>> = {
  subs: "No channels yet. Add one below.",
  top: "All topics. Add one to narrow it down.",
  home: "Recommendations come from what you watch. Add a topic to boost it.",
  claude: "Connect Claude to fill this in.",
  topics: "Nothing here yet. Add one below.",
};

export type TopicsPopupActions = Readonly<{
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  onMute: (topic: string) => void;
  onUnmute: (topic: string) => void;
}>;

type Props = TopicsPopupActions &
  Readonly<{
    feed: ListedFeed;
    popupProps: HTMLAttributes<HTMLElement> & { ref: RefCallback<HTMLElement> };
  }>;

/** Edits a feed's topic list (Subscriptions' channels, Everything's boosted topics): add, remove, mute and unmute. */
export function TopicsPopup({ feed, popupProps, onAdd, onRemove, onMute, onUnmute }: Props) {
  const labelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const key = listKeyOf(feed);
  const placeholder = key === "channels" ? "Add a channel" : "Add a topic";
  const active = activeItems(feed);

  const andRefocusInput = (act: (item: string) => void) => (item: string) => {
    act(item);
    setMessage("");
    input.current?.focus();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = checkNewItem(feed, text);
    if (result.kind === "message") {
      setMessage(result.message);
      return;
    }
    onAdd(result.item);
    setText("");
    setMessage("");
  };

  return (
    <div {...popupProps} className="popup topics-popup" aria-labelledby={labelId}>
      <p className="popup-label" id={labelId}>
        {LABELS[feed.kind]}
      </p>
      <ChipList
        active={active}
        muted={feed.muted}
        canMute={key === "topics"}
        empty={EMPTY[feed.kind]}
        onRemove={andRefocusInput(onRemove)}
        onMute={andRefocusInput(onMute)}
        onUnmute={andRefocusInput(onUnmute)}
      />
      <form className="topics-add" onSubmit={submit}>
        <input
          ref={input}
          type="text"
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setMessage("");
          }}
        />
        <button type="submit" className="icon-button" aria-label="Add">
          <IconPlus size={16} aria-hidden="true" />
        </button>
      </form>
      <p className="popup-message" role="status">
        {message}
      </p>
    </div>
  );
}

type CheckResult = Readonly<{ kind: "add"; item: string }> | Readonly<{ kind: "message"; message: string }>;

/** What typing `text` into the add box does: add an item (reusing the spelling of a hidden one) or explain why not. */
function checkNewItem(feed: Feed, text: string): CheckResult {
  const key = listKeyOf(feed);
  if (!text.trim()) return { kind: "message", message: key === "channels" ? "Type a channel name first." : "Type a topic first." };
  const typed = normaliseItem(key, text);
  if (includesIgnoringCase(activeItems(feed), typed)) return { kind: "message", message: "Already in this feed." };
  const known = (key === "topics" ? [...feed.topics, ...feed.muted] : feed.channels).find((x) => x.toLowerCase() === typed.toLowerCase());
  return { kind: "add", item: known ?? typed };
}

type ChipListProps = Readonly<{
  active: readonly string[];
  muted: readonly string[];
  canMute: boolean;
  empty: string;
  onRemove: (item: string) => void;
  onMute: (topic: string) => void;
  onUnmute: (topic: string) => void;
}>;

/** Active items with remove (and mute) buttons, then muted topics crossed out with a button to unmute. */
function ChipList({ active, muted, canMute, empty, onRemove, onMute, onUnmute }: ChipListProps) {
  if (!active.length && !muted.length) return <p className="popup-hint">{empty}</p>;
  return (
    <ul className="chips">
      {active.map((item) => (
        <li key={item} className="chip">
          {item}
          {canMute && (
            <button type="button" aria-label={`Hide ${item} from this feed`} title="Hide from this feed" onClick={() => onMute(item)}>
              <IconEyeOff size={12} aria-hidden="true" />
            </button>
          )}
          <button type="button" aria-label={`Remove ${item}`} title="Remove" onClick={() => onRemove(item)}>
            <IconX size={12} aria-hidden="true" />
          </button>
        </li>
      ))}
      {muted.map((topic) => (
        <li key={`muted-${topic}`} className="chip chip-muted" title="Hidden from this feed">
          <s>{topic}</s>
          <span className="visually-hidden"> (hidden)</span>
          <button type="button" aria-label={`Show ${topic} again`} title="Show again" onClick={() => onUnmute(topic)}>
            <IconEye size={12} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
