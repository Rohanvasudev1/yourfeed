import { IconCheck, IconChevronDown, IconCompass } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Feed } from "../domain/types";
import { kindInfo } from "./feedKindInfo";
import { useDismissal } from "./popup/useDismissal";

type Props = Readonly<{
  /** The built-in feeds grouped under Explore, in tab order. */
  feeds: readonly Feed[];
  current: Feed;
  /** Unread shares in Shared with you. */
  unread: number;
  onOpen: (name: string) => void;
}>;

/**
 * The one tab-bar button for the built-in feeds other than Home. It shows the open feed's
 * name and icon when one of them is open. Click toggles the menu; Escape, outside clicks and focus leaving it close it.
 */
export function ExploreMenu({ feeds, current, unread, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const unreadId = useId();
  const active = feeds.find((f) => f.name === current.name) ?? null;

  useDismissal(
    open,
    (target) => target instanceof Node && (wrapper.current?.contains(target) ?? false),
    (reason) => {
      setOpen(false);
      if (reason === "escape") button.current?.focus();
    },
  );

  useEffect(() => {
    if (!open) return;
    const target = menu.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? menu.current?.querySelector("button");
    target?.focus();
  }, [open]);

  const ActiveIcon = active ? kindInfo(active.kind)?.icon : IconCompass;
  const pick = (name: string) => {
    setOpen(false);
    onOpen(name);
  };

  return (
    <div className="explore" ref={wrapper}>
      <button
        ref={button}
        type="button"
        className="tab tab-explore"
        aria-label={active ? `${active.name}, Explore feeds` : "Explore feeds"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-current={active ? "page" : undefined}
        aria-describedby={unread > 0 ? unreadId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {ActiveIcon && <ActiveIcon size={16} aria-hidden="true" />}
        {active ? active.name : "Explore"}
        {unread > 0 && (
          <>
            <span className="tab-count" aria-hidden="true">
              {unread}
            </span>
            <span id={unreadId} className="visually-hidden">{`${unread} unread in Shared with you`}</span>
          </>
        )}
        <IconChevronDown size={13} className="muted" aria-hidden="true" />
      </button>
      {open && (
        <div ref={menu} id={menuId} className="popup explore-menu" role="dialog" aria-label="Explore feeds">
          <p className="popup-label">Explore</p>
          {feeds.map((f) => (
            <ExploreItem key={f.name} feed={f} isCurrent={f === active} unread={f.kind === "shared" ? unread : 0} onPick={() => pick(f.name)} />
          ))}
          <p className="popup-hint">Built-in feeds live here. Your own feeds stay in the tab bar.</p>
        </div>
      )}
    </div>
  );
}

type ItemProps = Readonly<{ feed: Feed; isCurrent: boolean; unread: number; onPick: () => void }>;

function ExploreItem({ feed, isCurrent, unread, onPick }: ItemProps) {
  const info = kindInfo(feed.kind);
  const Icon = info?.icon;
  return (
    <button type="button" className="explore-item" aria-current={isCurrent ? "page" : undefined} onClick={onPick}>
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span className="explore-item-text">
        <span className="explore-item-name">{feed.name}</span>
        <span className="explore-item-desc">{info?.description}</span>
      </span>
      {unread > 0 && (
        <span className="tab-count">
          {unread}
          <span className="visually-hidden"> unread</span>
        </span>
      )}
      {isCurrent && unread === 0 && <IconCheck size={16} aria-hidden="true" />}
    </button>
  );
}
