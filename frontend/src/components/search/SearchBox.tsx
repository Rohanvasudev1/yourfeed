import { IconMicrophone, IconPlayerStopFilled, IconSearch } from "@tabler/icons-react";
import { useId, useRef, type KeyboardEvent } from "react";
import type { SuggestionCorpus } from "../../domain/search";
import { useVoiceTyping } from "../../state/useVoiceTyping";
import { optionId } from "./ids";
import { SuggestionList } from "./SuggestionList";
import { useSuggestions } from "./useSuggestions";
import "./search.css";

type Props = Readonly<{
  corpus: SuggestionCorpus;
  recent: readonly string[];
  onSearch: (query: string) => void;
  onForget: (phrase: string) => void;
  /** Shows voice search's messages. */
  onMessage: (message: string) => void;
}>;

const VOICE_SEARCH = { name: "Voice search", purpose: "search by voice" } as const;
/** Voice search has one target: the box. */
const BOX = "search";

/** The header's search box with Google-style suggestions, and the mic that fills it by voice. */
export function SearchBox({ corpus, recent, onSearch, onForget, onMessage }: Props) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const box = useSuggestions(corpus, recent);
  const voice = useVoiceTyping<typeof BOX>({
    keyOf: (target) => target,
    continuous: false,
    words: VOICE_SEARCH,
    onHeard: (_, heard) => {
      // Focusing reopens the list for the old text, so the new text is set after it.
      input.current?.focus();
      box.type(heard);
    },
    onMessage,
  });
  const listening = voice.isListening(BOX);

  const search = (text: string) => {
    box.close();
    if (!text.trim()) return;
    input.current?.blur();
    onSearch(text.trim());
  };

  const removeActive = () => {
    const item = box.items[box.active];
    if (!item?.recent) return false;
    onForget(item.phrase);
    box.unhighlight();
    return true;
  };

  const open = box.items.length > 0;

  /** Runs the key's combobox action; false when the key isn't one of them. */
  const runKey = (event: KeyboardEvent<HTMLInputElement>): boolean => {
    switch (event.key) {
      case "Enter":
        search(box.text);
        return true;
      case "ArrowDown":
        box.move(1);
        return true;
      case "ArrowUp":
        box.move(-1);
        return true;
      case "Escape":
        if (open) box.dismiss();
        return open;
      case "Delete":
        return event.shiftKey && removeActive();
      default:
        return false;
    }
  };

  return (
    <div className="search">
      <div className={`search-box${open ? " open" : ""}`}>
        <div className="search-bar">
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="Search"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={box.active >= 0 ? optionId(listId, box.active) : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={listening ? "Listening…" : "Search"}
            value={box.text}
            onChange={(e) => box.type(e.target.value)}
            onFocus={box.reopen}
            onBlur={box.close}
            onKeyDown={(event) => runKey(event) && event.preventDefault()}
          />
          <button type="button" className="search-go" aria-label="Search" title="Search" onClick={() => search(box.text)}>
            <IconSearch size={18} aria-hidden="true" />
          </button>
        </div>
        {open && (
          <SuggestionList
            id={listId}
            items={box.items}
            active={box.active}
            typed={box.typed}
            onSearch={search}
            onFill={(phrase) => box.type(`${phrase} `)}
            onRemove={onForget}
          />
        )}
      </div>
      <button
        type="button"
        className={`search-mic${listening ? " on" : ""}`}
        aria-label={listening ? "Stop listening" : "Search with your voice"}
        title={listening ? "Stop listening" : "Search with your voice"}
        aria-pressed={listening}
        onClick={() => voice.toggle(BOX)}
      >
        {listening ? <IconPlayerStopFilled size={16} aria-hidden="true" /> : <IconMicrophone size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
