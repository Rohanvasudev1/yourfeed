import { LENGTH_LIMITS, SESSION_LIMITS, type RangeLimits } from "../domain/range";

/** One range setting's popup: its title, limits, help text and the names of its four controls. */
export type RangeSetting = Readonly<{
  label: string;
  hint: string;
  limits: RangeLimits;
  minName: string;
  maxName: string;
}>;

export const LENGTH_SETTING: RangeSetting = {
  label: "Video length",
  hint: "Only videos inside this range show up.",
  limits: LENGTH_LIMITS,
  minName: "Shortest video",
  maxName: "Longest video",
};

export const SESSION_SETTING: RangeSetting = {
  label: "Session time",
  hint: "How long this sitting should be. Up next fills to fit.",
  limits: SESSION_LIMITS,
  minName: "Minimum session time",
  maxName: "Maximum session time",
};
