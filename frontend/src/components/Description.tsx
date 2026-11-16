import { IconChevronDown, IconChevronUp, IconX } from "@tabler/icons-react";
import { describeVideo, flatDescription } from "../domain/description";
import type { Video } from "../domain/types";

type ToggleProps = Readonly<{ video: Video; title: string; open: boolean; onToggle: () => void }>;

const descriptionId = (video: Video) => `description-${video.id}`;
const toggleId = (video: Video) => `description-toggle-${video.id}`;
const toggleLabel = (title: string) => `Description of ${title}`;

/** Grid view: a one-line preview that opens the full description in a panel under the row. */
export function GridDescriptionToggle({ video, title, open, onToggle }: ToggleProps) {
  const Chevron = open ? IconChevronUp : IconChevronDown;
  return (
    <button
      type="button"
      id={toggleId(video)}
      className="grid-desc"
      aria-label={toggleLabel(title)}
      aria-expanded={open}
      aria-controls={open ? descriptionId(video) : undefined}
      onClick={onToggle}
    >
      <span aria-hidden="true">{flatDescription(describeVideo(video))}</span>
      <Chevron size={14} aria-hidden="true" />
    </button>
  );
}

/** List view: two lines with …more, opening in place. The text sits outside the button so it is read out. */
export function ListDescription({ video, title, open, onToggle }: ToggleProps) {
  const description = describeVideo(video);
  return (
    <div className={open ? "desc-box open" : "desc-box"}>
      <p id={descriptionId(video)} className={open ? "desc-full" : "clamp"}>
        {open ? description : flatDescription(description)}
      </p>
      <button
        type="button"
        className="desc-more"
        aria-label={toggleLabel(title)}
        aria-expanded={open}
        aria-controls={descriptionId(video)}
        onClick={onToggle}
      >
        {open ? "Show less" : "…more"}
      </button>
    </div>
  );
}

type PanelProps = Readonly<{ video: Video; title: string; onClose: () => void }>;

/** Grid view: the full description, spanning the whole row so the card never changes size. */
export function DescriptionPanel({ video, title, onClose }: PanelProps) {
  const close = () => {
    onClose();
    document.getElementById(toggleId(video))?.focus();
  };
  return (
    <section className="grid-panel" id={descriptionId(video)} aria-label={title}>
      <div className="grid-panel-head">
        <p className="grid-panel-title">{title}</p>
        <button type="button" className="icon-button" aria-label="Hide description" title="Hide description" onClick={close}>
          <IconX size={15} aria-hidden="true" />
        </button>
      </div>
      <p className="desc-full">{describeVideo(video)}</p>
    </section>
  );
}
