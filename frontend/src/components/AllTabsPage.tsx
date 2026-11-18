import {
  IconAlignJustified,
  IconApps,
  IconArrowBarToDown,
  IconArrowBarToUp,
  IconArrowsMinimize,
  IconCircle,
  IconCircleCheck,
  IconLayoutNavbar,
} from "@tabler/icons-react";
import { useId, useState, type ReactNode } from "react";
import { barSpaces, canShelve, MAX_BAR_SPACES } from "../domain/tabs";
import type { Feed } from "../domain/types";
import type { EditControls } from "../state/useEditMode";
import type { TabControls } from "../state/useTabs";
import { kindInfo } from "./feedKindInfo";

type Props = Readonly<{ feeds: readonly Feed[]; tabs: TabControls; edit: EditControls }>;

const TOPICS_SHOWN = 2;

/**
 * Every feed, split into the ones in the tab bar and the ones only here, each one click from the other side.
 * In edit mode each card's name selects it instead.
 */
export function AllTabsPage({ feeds, tabs, edit }: Props) {
  const titleId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const inBar = feeds.filter((f) => !f.shelved);
  const shelved = feeds.filter((f) => f.shelved);

  const toggle = (feed: Feed) => setMessage(tabs.toggleShelved(feed));
  const group = (list: readonly Feed[]) => <TabCards feeds={list} onOpen={tabs.open} onToggle={toggle} edit={edit} />;

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

type CardsProps = Readonly<{
  feeds: readonly Feed[];
  onOpen: (name: string) => void;
  onToggle: (feed: Feed) => void;
  edit: EditControls;
}>;

function TabCards({ feeds, onOpen, onToggle, edit }: CardsProps) {
  return (
    <ul className="tab-cards">
      {feeds.map((f) => {
        const Icon = kindInfo(f.kind)?.icon ?? IconAlignJustified;
        const selected = edit.selected.includes(f.name);
        const Check = selected ? IconCircleCheck : IconCircle;
        return (
          <li key={f.name} className={selected ? "tab-card selected" : "tab-card"}>
            <Icon size={22} className="muted" aria-hidden="true" />
            {edit.editing && <Check size={20} className="tab-card-check" aria-hidden="true" />}
            <h4>
              {edit.editing ? (
                <button type="button" className="tab-card-open" aria-pressed={selected} onClick={() => edit.toggle(f.name)}>
                  {f.name}
                </button>
              ) : (
                <button type="button" className="tab-card-open" onClick={() => onOpen(f.name)}>
                  {f.name}
                </button>
              )}
            </h4>
            <p className="tab-card-desc">{describe(f)}</p>
            {!edit.editing && canShelve(f) && (
              <button
                type="button"
                className={f.shelved ? "tab-card-move primary" : "tab-card-move"}
                aria-label={f.shelved ? `Add ${f.name} to the tab bar` : `Move ${f.name} to All tabs`}
                onClick={() => onToggle(f)}
              >
                {f.shelved ? <IconArrowBarToUp size={14} aria-hidden="true" /> : <IconArrowBarToDown size={14} aria-hidden="true" />}
                {f.shelved ? "Add to tab bar" : "Move to All tabs"}
              </button>
            )}
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
