import { IconApps, IconHome, IconPin, IconPlus, IconSparkles, IconX } from "@tabler/icons-react";
import { useRef, type DragEvent } from "react";
import { isInExplore } from "../domain/feed";
import { ownTabs } from "../domain/tabs";
import type { Feed } from "../domain/types";
import type { TabControls } from "../state/useTabs";
import { ExploreMenu } from "./ExploreMenu";
import { kindInfo } from "./feedKindInfo";
import "./tabs.css";

type Props = Readonly<{ feeds: readonly Feed[]; current: Feed; tabs: TabControls }>;

/**
 * Home, the Explore button, then your own feeds (each with a × that shelves it, and draggable to
 * reorder). A shelved feed you open shows at the end with a pin. New feed and All tabs sit beside the bar.
 */
export function TabBar({ feeds, current, tabs }: Props) {
  const onFeedPage = tabs.page === "feed";
  const inBar = feeds.filter((f) => !f.shelved);
  const home = inBar.find((f) => f.kind === "home");
  const explore = inBar.filter(isInExplore);
  const temporary = onFeedPage && current.shelved ? current : null;
  const shelvedCount = feeds.filter((f) => f.shelved).length;
  const currentPage = (f: Feed) => (onFeedPage && f.name === current.name ? "page" : undefined);
  const dragged = useRef<string | null>(null);

  const dragProps = (f: Feed) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      dragged.current = f.name;
      e.dataTransfer.setData("text/plain", f.name);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: DragEvent) => {
      if (dragged.current) e.preventDefault();
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragged.current) tabs.move(dragged.current, f.name);
      dragged.current = null;
    },
    onDragEnd: () => {
      dragged.current = null;
    },
  });

  return (
    <div className="tab-row">
      <nav className="tab-bar" aria-label="Feeds">
        {home && (
          <button
            type="button"
            className="tab tab-home"
            aria-label={`${home.name} (home)`}
            title={home.name}
            aria-current={currentPage(home)}
            onClick={() => tabs.open(home.name)}
          >
            <IconHome size={17} aria-hidden="true" />
          </button>
        )}
        {explore.length > 0 && <ExploreMenu feeds={explore} current={current} onOpen={tabs.open} />}
        {ownTabs(feeds).map((f) => (
          <span key={f.name} className="tab-chip" {...dragProps(f)}>
            <button type="button" className="tab" aria-current={currentPage(f)} onClick={() => tabs.open(f.name)}>
              {f.draft && <IconSparkles size={14} aria-hidden="true" />}
              {f.name}
            </button>
            <button type="button" className="tab-close" aria-label={`Close ${f.name}`} title="Close tab" onClick={() => tabs.close(f.name)}>
              <IconX size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
        {temporary && <TemporaryTab feed={temporary} onPin={() => tabs.pin(temporary.name)} />}
      </nav>
      <div className="tab-tools">
        <button type="button" className="icon-button" aria-label="New feed" title="New feed" onClick={tabs.newFeed}>
          <IconPlus size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="tab-all"
          aria-label="All tabs"
          title="All tabs"
          aria-current={onFeedPage ? undefined : "page"}
          onClick={onFeedPage ? tabs.openAllTabs : tabs.closeAllTabs}
        >
          <IconApps size={17} aria-hidden="true" />
          {shelvedCount > 0 && <span aria-hidden="true">{shelvedCount}</span>}
        </button>
      </div>
    </div>
  );
}

/** A shelved feed shown in the bar only while it's open, with a pin to keep it there. */
function TemporaryTab({ feed, onPin }: Readonly<{ feed: Feed; onPin: () => void }>) {
  const Icon = feed.draft ? IconSparkles : kindInfo(feed.kind)?.icon;
  return (
    <span className="tab-chip tab-temporary">
      <button type="button" className="tab" aria-current="page">
        {Icon && <Icon size={14} aria-hidden="true" />}
        {feed.name}
      </button>
      <button type="button" className="tab-pin" aria-label={`Keep ${feed.name} in the tab bar`} title="Keep in tab bar" onClick={onPin}>
        <IconPin size={14} aria-hidden="true" />
      </button>
    </span>
  );
}
