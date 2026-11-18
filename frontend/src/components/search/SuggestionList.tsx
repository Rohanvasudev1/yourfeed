import { IconArrowUpLeft, IconHistory, IconSearch, IconX } from "@tabler/icons-react";
import type { MouseEvent } from "react";
import { highlightUntyped, type Suggestion } from "../../domain/search";
import { optionId } from "./ids";

type Props = Readonly<{
  id: string;
  items: readonly Suggestion[];
  active: number;
  typed: string;
  onSearch: (phrase: string) => void;
  onFill: (phrase: string) => void;
  onRemove: (phrase: string) => void;
}>;

/** Keeps focus in the search box when a suggestion or its buttons are pressed. */
const keepFocus = (event: MouseEvent) => event.preventDefault();

/**
 * The suggestions under the search box. The remove and fill-in buttons are for the mouse; from the
 * keyboard, the arrows fill the box and Shift+Delete removes a highlighted recent search.
 */
export function SuggestionList({ id, items, active, typed, onSearch, onFill, onRemove }: Props) {
  const act = (event: MouseEvent, run: () => void) => {
    event.stopPropagation();
    run();
  };
  return (
    <ul id={id} role="listbox" aria-label="Search suggestions" className="suggestions">
      {items.map((item, i) => (
        <li
          key={item.phrase}
          id={optionId(id, i)}
          role="option"
          aria-selected={i === active}
          aria-label={item.recent ? `${item.phrase}, recent search` : item.phrase}
          className={`suggestion${item.recent ? " recent" : ""}${i === active ? " active" : ""}`}
          onMouseDown={keepFocus}
          onClick={() => onSearch(item.phrase)}
        >
          {item.recent ? <IconHistory size={17} aria-hidden="true" /> : <IconSearch size={17} aria-hidden="true" />}
          <span className="suggestion-text">
            {highlightUntyped(item.phrase, typed).map((part, j) => (part.bold ? <b key={j}>{part.text}</b> : <span key={j}>{part.text}</span>))}
          </span>
          {item.recent && (
            <button
              type="button"
              tabIndex={-1}
              className="suggestion-button"
              aria-label={`Remove ${item.phrase} from recent searches`}
              title="Remove"
              onMouseDown={keepFocus}
              onClick={(e) => act(e, () => onRemove(item.phrase))}
            >
              <IconX size={15} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            className="suggestion-button"
            aria-label={`Fill in ${item.phrase}`}
            title="Fill in"
            onMouseDown={keepFocus}
            onClick={(e) => act(e, () => onFill(item.phrase))}
          >
            <IconArrowUpLeft size={16} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
