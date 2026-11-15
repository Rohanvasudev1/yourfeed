import { IconCheck, IconChevronDown, IconCompass } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Feed } from "../domain/types";
import { kindInfo } from "./feedKindInfo";

type Props = Readonly<{
  /** The built-in feeds grouped under Explore, in tab order. */
  feeds: readonly Feed[];
  current: Feed;
  onOpen: (name: string) => void;
}>;

/**
 * The one tab-bar button for the built-in feeds other than Home. It shows the open feed's
 * name and icon when one of them is open. Click toggles the menu; Escape, outside clicks and focus leaving it close it.
 */
export function ExploreMenu({ feeds, current, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = feeds.find((f) => f.name === current.name) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const closeIfOutside = (e: Event) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("focusin", closeIfOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("focusin", closeIfOutside);
    };
  }, [open]);

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
        onClick={() => setOpen((o) => !o)}
      >
        {ActiveIcon && <ActiveIcon size={16} aria-hidden="true" />}
        {active ? active.name : "Explore"}
        <IconChevronDown size={13} className="muted" aria-hidden="true" />
      </button>
      {open && (
        <div ref={menu} id={menuId} className="popup explore-menu" role="dialog" aria-label="Explore feeds">
          <p className="popup-label">Explore</p>
          {feeds.map((f) => (
            <ExploreItem key={f.name} feed={f} isCurrent={f === active} onPick={() => pick(f.name)} />
          ))}
          <p className="popup-hint">Built-in feeds live here. Your own feeds stay in the tab bar.</p>
        </div>
      )}
    </div>
  );
}

function ExploreItem({ feed, isCurrent, onPick }: Readonly<{ feed: Feed; isCurrent: boolean; onPick: () => void }>) {
  const info = kindInfo(feed.kind);
  const Icon = info?.icon;
  return (
    <button type="button" className="explore-item" aria-current={isCurrent ? "page" : undefined} onClick={onPick}>
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span className="explore-item-text">
        <span className="explore-item-name">{feed.name}</span>
        <span className="explore-item-desc">{info?.description}</span>
      </span>
      {isCurrent && <IconCheck size={16} aria-hidden="true" />}
    </button>
  );
}
