import { IconChevronDown, IconChevronRight, type Icon } from "@tabler/icons-react";
import { useId, type ReactNode } from "react";
import type { GlobalFilters, Video } from "../../domain/types";
import type { Library } from "../../state/useLibrary";
import type { SectionControl } from "../../state/useSections";
import "./library.css";

/** What the Saved and Watch history sections, and their rows, need from the app. */
export type LibraryProps = Readonly<{ library: Library; filters: GlobalFilters; onPlay: (video: Video) => void; control: SectionControl }>;

type Props = Readonly<{
  name: string;
  icon: Icon;
  /** Shown after the name, such as "3 folders · 6 videos". */
  summary: string;
  control: SectionControl;
  children: ReactNode;
}>;

/** A collapsed-by-default section at the bottom of the page, as Saved and Watch history are in the mockup. */
export function LibrarySection({ name, icon: SectionIcon, summary, control: { open, onToggle, toggleId }, children }: Props) {
  const bodyId = useId();
  const Chevron = open ? IconChevronDown : IconChevronRight;
  return (
    <section className="library-section" aria-label={name}>
      <h2 className="section-label">
        <button type="button" id={toggleId} className="section-toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <Chevron size={16} aria-hidden="true" />
          <SectionIcon size={17} aria-hidden="true" />
          <span className="section-toggle-name">{name}</span>
          <span className="muted small">{summary}</span>
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="library-body">
          {children}
        </div>
      )}
    </section>
  );
}
