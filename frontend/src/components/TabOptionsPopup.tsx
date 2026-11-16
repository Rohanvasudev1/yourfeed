import { IconApps, IconArrowLeft, IconArrowRight, IconLayoutNavbar, IconTrash } from "@tabler/icons-react";
import { useId, useState, type HTMLAttributes, type RefCallback } from "react";
import { isBuiltIn } from "../domain/feed";
import { canShelve } from "../domain/tabs";
import type { Feed } from "../domain/types";
import type { TabControls } from "../state/useTabs";

export type TabOptions = Pick<TabControls, "toggleShelved" | "remove" | "move" | "neighbours">;

type Props = Readonly<{
  feed: Feed;
  options: TabOptions;
  popupProps: HTMLAttributes<HTMLElement> & { ref: RefCallback<HTMLElement> };
}>;

/** The ⋯ popup: move the open feed to All tabs or back, move it left or right, and delete it (your own feeds only). */
export function TabOptionsPopup({ feed, options, popupProps }: Props) {
  const labelId = useId();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const { left, right } = options.neighbours(feed.name);

  return (
    <div {...popupProps} className="popup tab-options" aria-labelledby={labelId}>
      <p className="popup-label" id={labelId}>
        Tab options
      </p>
      {canShelve(feed) && (
        <button type="button" className="popup-action" onClick={() => setMessage(options.toggleShelved(feed) ?? "")}>
          {feed.shelved ? <IconLayoutNavbar size={16} aria-hidden="true" /> : <IconApps size={16} aria-hidden="true" />}
          {feed.shelved ? "Show in tab bar" : "Move to All tabs"}
        </button>
      )}
      {left && (
        <button type="button" className="popup-action" onClick={() => options.move(feed.name, left)}>
          <IconArrowLeft size={16} aria-hidden="true" />
          Move left
        </button>
      )}
      {right && (
        <button type="button" className="popup-action" onClick={() => options.move(feed.name, right)}>
          <IconArrowRight size={16} aria-hidden="true" />
          Move right
        </button>
      )}
      {isBuiltIn(feed) ? (
        <p className="popup-hint">Built-in tabs can be moved but not deleted.</p>
      ) : confirming ? (
        <div className="tab-options-confirm">
          <p>{`Delete "${feed.name}"? This can't be undone.`}</p>
          <div className="tab-options-buttons">
            <button type="button" className="text-button danger" onClick={() => options.remove(feed.name)}>
              Delete
            </button>
            {/* Cancel takes focus so a stray Enter can't delete. */}
            <button type="button" className="text-button" autoFocus onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="popup-action danger" onClick={() => setConfirming(true)}>
          <IconTrash size={16} aria-hidden="true" />
          Delete tab
        </button>
      )}
      <p className="popup-message" role="status">
        {message}
      </p>
    </div>
  );
}
