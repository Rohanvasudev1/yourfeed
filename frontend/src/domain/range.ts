import type { Range } from "./types";

/** The lowest and highest minutes a range setting allows, and how far one slider step moves. */
export type RangeLimits = Readonly<{ lowest: number; highest: number; step: number }>;

export const LENGTH_LIMITS: RangeLimits = { lowest: 1, highest: 120, step: 1 };
export const SESSION_LIMITS: RangeLimits = { lowest: 10, highest: 240, step: 10 };

export const NOT_WHOLE_MINUTES = "Enter whole numbers of minutes.";

export type TypedRange = Readonly<{ kind: "range"; range: Range }> | Readonly<{ kind: "message"; message: string }>;

const WHOLE_NUMBER = /^\d+$/;

/**
 * What typing `minText` and `maxText` into the number boxes does: non-numbers are rejected,
 * values are clamped to the limits, swapped when the minimum is above the maximum, and pulled
 * one step apart when equal.
 */
export function typedRange(limits: RangeLimits, minText: string, maxText: string): TypedRange {
  const [minTrimmed, maxTrimmed] = [minText.trim(), maxText.trim()];
  if (!WHOLE_NUMBER.test(minTrimmed) || !WHOLE_NUMBER.test(maxTrimmed)) return { kind: "message", message: NOT_WHOLE_MINUTES };
  const clamp = (n: number) => Math.max(limits.lowest, Math.min(limits.highest, n));
  const [a, b] = [clamp(Number(minTrimmed)), clamp(Number(maxTrimmed))];
  return { kind: "range", range: keepOneStepApart(limits, [Math.min(a, b), Math.max(a, b)]) };
}

/** Keeps an empty range one step wide, inside the limits. */
function keepOneStepApart(limits: RangeLimits, [min, max]: Range): Range {
  if (min < max) return [min, max];
  return max + limits.step <= limits.highest ? [min, max + limits.step] : [min - limits.step, max];
}

/** Moves the minimum thumb to `value`, stopping one step below the maximum. */
export const dragMin = (limits: RangeLimits, [, max]: Range, value: number): Range => [Math.min(value, max - limits.step), max];

/** Moves the maximum thumb to `value`, stopping one step above the minimum. */
export const dragMax = (limits: RangeLimits, [min]: Range, value: number): Range => [min, Math.max(value, min + limits.step)];
