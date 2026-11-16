import { IconAlignJustified, IconApps, IconArrowBarToDown, IconArrowBarToUp, IconArrowsMinimize, IconLayoutNavbar } from "@tabler/icons-react";
import { useId, useState, type ReactNode } from "react";
import { barSpaces, MAX_BAR_SPACES } from "../domain/tabs";
import type { Feed } from "../domain/types";
import type { TabControls } from "../state/useTabs";
import { kindInfo } from "./feedKindInfo";

type Props = Readonly<{ feeds: readonly Feed[]; tabs: TabControls }>;

const TOPICS_SHOWN = 2;

/** Every feed, split into the ones in the tab bar and the ones only here, each one click from the other side. */
export function AllTabsPage({ feeds, tabs }: Props) {
  const titleId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const inBar = feeds.filter((f) => !f.shelved);
  const shelved = feeds.filter((f) => f.shelved);

  const toggle = (feed: Feed) => {
    if (feed.shelved) setMessage(tabs.showInBar(feed.name));
    else {
      tabs.shelve(feed.name);
      setMessage(null);
    }
  };
  const group = (list: readonly Feed[]) => <TabCards feeds={list} onOpen={tabs.open} onToggle={toggle} />;

  return (
    <section className="all-tabs" aria-labelledby={titleId}>
      <div className="all-tabs-head">
        <h2 id={titleId}>All tabs</h2>
        <span className="muted small">{feeds.length} feeds</span>
        <button type="button" className="icon-button" aria-label="Minimize All tabs" title="Minimize" onClick={tabs.closeAllTabs}>
          <IconArrowsMinimize size={16} aria-hidden="true" />
        </button>
      </div>
      {message && (
        <p className="all-tabs-message" role="alert">
          {message}
        </p>
      )}
      <TabGroup
        icon={<IconLayoutNavbar size={16} aria-hidden="true" />}
        title="In the tab bar"
        note={`${barSpaces(feeds)} of ${MAX_BAR_SPACES} spaces · built-in feeds share the Explore button`}
      >
        {group(inBar)}
      </TabGroup>
      <TabGroup icon={<IconApps size={16} aria-hidden="true" />} title="Only in All tabs" note={String(shelved.length)}>
        {shelved.length ? group(shelved) : <p className="muted small">Every feed is in the tab bar.</p>}
      </TabGroup>
    </section>
  );
}

function TabGroup({ icon, title, note, children }: Readonly<{ icon: ReactNode; title: string; note: string; children: ReactNode }>) {
  const id = useId();
  return (
    <section className="all-tabs-group" aria-labelledby={id}>
      <div className="all-tabs-group-label">
        {icon}
        <h3 id={id}>{title}</h3>
        <span className="muted">{note}</span>
      </div>
      {children}
    </section>
  );
}

type CardsProps = Readonly<{ feeds: readonly Feed[]; onOpen: (name: string) => void; onToggle: (feed: Feed) => void }>;

function TabCards({ feeds, onOpen, onToggle }: CardsProps) {
  return (
    <ul className="tab-cards">
      {feeds.map((f) => {
        const Icon = kindInfo(f.kind)?.icon ?? IconAlignJustified;
        return (
          <li key={f.name} className="tab-card">
            <Icon size={22} className="muted" aria-hidden="true" />
            <h4>
              <button type="button" className="tab-card-open" onClick={() => onOpen(f.name)}>
                {f.name}
              </button>
            </h4>
            <p className="tab-card-desc">{describe(f)}</p>
            <button
              type="button"
              className={f.shelved ? "tab-card-move primary" : "tab-card-move"}
              aria-label={f.shelved ? `Add ${f.name} to the tab bar` : `Move ${f.name} to All tabs`}
              onClick={() => onToggle(f)}
            >
              {f.shelved ? <IconArrowBarToUp size={14} aria-hidden="true" /> : <IconArrowBarToDown size={14} aria-hidden="true" />}
              {f.shelved ? "Add to tab bar" : "Move to All tabs"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function describe(feed: Feed): string {
  const info = kindInfo(feed.kind);
  if (info) return info.description;
  const { topics } = feed;
  const count = `${topics.length} topic${topics.length === 1 ? "" : "s"}`;
  if (!topics.length) return count;
  return `${count}: ${topics.slice(0, TOPICS_SHOWN).join(", ")}${topics.length > TOPICS_SHOWN ? "…" : ""}`;
}
