import { useEffect, useId, useRef, useState, type FocusEvent, type HTMLAttributes, type RefCallback } from "react";
import { dragMax, dragMin, typedRange } from "../domain/range";
import type { Range } from "../domain/types";
import "./RangePopup.css";
import type { RangeSetting } from "./rangeSettings";

type Props = Readonly<{
  setting: RangeSetting;
  value: Range;
  onChange: (range: Range) => void;
  popupProps: HTMLAttributes<HTMLElement> & { ref: RefCallback<HTMLElement> };
}>;

/** What the visitor has typed but not applied yet; `null` shows the feed's value. */
type Drafts = Readonly<{ min: string | null; max: string | null }>;
const NO_DRAFTS: Drafts = { min: null, max: null };

const sameRange = (a: Range, b: Range) => a[0] === b[0] && a[1] === b[1];

/**
 * A min–max slider plus number boxes. Dragging applies at once, so Up next follows the thumb.
 * Typed values apply together on Enter, when focus leaves the boxes, or when the popup closes,
 * so typing 90 then 10 means 10–90 rather than two separate edits.
 */
export function RangePopup({ setting, value, onChange, popupProps }: Props) {
  const labelId = useId();
  const [drafts, setDrafts] = useState<Drafts>(NO_DRAFTS);
  const [message, setMessage] = useState("");
  const { limits } = setting;

  const change = (range: Range) => {
    if (!sameRange(range, value)) onChange(range);
  };

  const applyDrafts = () => {
    if (drafts === NO_DRAFTS) return;
    const result = typedRange(limits, drafts.min ?? String(value[0]), drafts.max ?? String(value[1]));
    if (result.kind === "message") {
      setMessage(result.message);
      return;
    }
    setDrafts(NO_DRAFTS);
    setMessage("");
    change(result.range);
  };

  const latestApply = useRef(applyDrafts);
  useEffect(() => {
    latestApply.current = applyDrafts;
  });
  // A click outside closes the popup before the box loses focus, so apply what was typed on the way out.
  useEffect(() => () => latestApply.current(), []);

  const leaveBoxes = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) applyDrafts();
  };

  const box = (end: keyof Drafts, name: string, shown: number) => (
    <input
      type="number"
      min={limits.lowest}
      max={limits.highest}
      aria-label={`${name} in minutes`}
      value={drafts[end] ?? String(shown)}
      onChange={(e) => {
        setDrafts((d) => ({ ...d, [end]: e.target.value }));
        setMessage("");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") applyDrafts();
      }}
    />
  );

  return (
    <div {...popupProps} className="popup range-popup" aria-labelledby={labelId}>
      <p className="popup-label" id={labelId}>
        {setting.label}
      </p>
      <DualSlider setting={setting} value={value} onChange={change} />
      <div className="range-boxes" onBlur={leaveBoxes}>
        {box("min", setting.minName, value[0])}
        <span>to</span>
        {box("max", setting.maxName, value[1])}
        <span>min</span>
      </div>
      <p className="popup-hint">{setting.hint}</p>
      <p className="popup-message" role="status">
        {message}
      </p>
    </div>
  );
}

type DualSliderProps = Readonly<{ setting: RangeSetting; value: Range; onChange: (range: Range) => void }>;

/** Two range inputs over one track, with the chosen span filled in. The thumbs never cross. */
function DualSlider({ setting, value, onChange }: DualSliderProps) {
  const { lowest, highest, step } = setting.limits;
  const percent = (n: number) => ((n - lowest) / (highest - lowest)) * 100;
  const thumb = (name: string, shown: number, drag: (n: number) => Range) => (
    <input
      type="range"
      min={lowest}
      max={highest}
      step={step}
      aria-label={name}
      value={shown}
      onChange={(e) => onChange(drag(Number(e.target.value)))}
    />
  );
  return (
    <div className="dual-range">
      <div className="dual-range-track" aria-hidden="true">
        <div className="dual-range-fill" style={{ left: `${percent(value[0])}%`, width: `${percent(value[1]) - percent(value[0])}%` }} />
      </div>
      {thumb(setting.minName, value[0], (n) => dragMin(setting.limits, value, n))}
      {thumb(setting.maxName, value[1], (n) => dragMax(setting.limits, value, n))}
    </div>
  );
}
