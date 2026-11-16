import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FEEDS_CATALOG } from "./test/feedsCatalog";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp } from "./test/renderApp";

const renderFeeds = (storage = memoryStorage()) => renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage });

const settingsLine = () => screen.getByRole("group", { name: "Feed settings" });
const upNextLine = () => screen.getByRole("note", { name: "Session plan" });
const lengthPhrase = () => within(settingsLine()).getByRole("button", { name: /^Video length/ });
const sessionPhrase = () => within(settingsLine()).getByRole("button", { name: /^Session time/ });

/** The settings line as read aloud, leaving out any popup open inside it. */
function sentence(): string {
  const line = settingsLine().cloneNode(true) as HTMLElement;
  line.querySelectorAll('[role="dialog"]').forEach((popup) => popup.remove());
  return (line.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Opens Learn (10–60 min videos, 30–90 min sessions; three 20-minute videos fit) and one of its range popups. */
async function openLearnPopup(phrase: () => HTMLElement, name: string) {
  renderFeeds();
  await userEvent.click(within(screen.getByRole("navigation", { name: "Feeds" })).getByRole("button", { name: "Learn" }));
  expect(await feedTitles()).toHaveLength(3);
  await userEvent.click(phrase());
  return screen.getByRole("dialog", { name });
}

/** Types into both number boxes, then presses Enter. */
async function typeRange(popup: HTMLElement, names: readonly [string, string], [min, max]: readonly [string, string]) {
  const [low, high] = names.map((n) => within(popup).getByRole("spinbutton", { name: n }));
  await userEvent.clear(low);
  if (min) await userEvent.type(low, min);
  await userEvent.clear(high);
  await userEvent.type(high, `${max}{Enter}`);
}

const LENGTH_BOXES = ["Shortest video in minutes", "Longest video in minutes"] as const;
const SESSION_BOXES = ["Minimum session time in minutes", "Maximum session time in minutes"] as const;

/** Drags a slider the way a pointer does: focus lands on it and its value moves. */
function drag(slider: HTMLElement, value: number) {
  act(() => slider.focus());
  fireEvent.change(slider, { target: { value: String(value) } });
}

describe("the video length popup", () => {
  it("shows the feed's range on a slider and in number boxes", async () => {
    const popup = await openLearnPopup(lengthPhrase, "Video length");
    expect(within(popup).getByRole("slider", { name: "Shortest video" })).toHaveValue("10");
    expect(within(popup).getByRole("slider", { name: "Longest video" })).toHaveValue("60");
    expect(within(popup).getByRole("spinbutton", { name: LENGTH_BOXES[0] })).toHaveValue(10);
    expect(within(popup).getByRole("spinbutton", { name: LENGTH_BOXES[1] })).toHaveValue(60);
  });

  it("updates Up next live while dragging, and the popup stays open", async () => {
    const popup = await openLearnPopup(lengthPhrase, "Video length");
    const shortest = within(popup).getByRole("slider", { name: "Shortest video" });

    drag(shortest, 25);
    expect(await feedTitles()).toEqual([]);
    expect(sentence()).toContain("25–60 min videos");
    expect(screen.getByRole("dialog", { name: "Video length" })).toBe(popup);
    expect(shortest).toHaveFocus();

    drag(shortest, 15);
    expect(await feedTitles()).toHaveLength(3);
    expect(within(popup).getByRole("spinbutton", { name: LENGTH_BOXES[0] })).toHaveValue(15);
  });

  it("never lets the thumbs cross", async () => {
    const popup = await openLearnPopup(lengthPhrase, "Video length");
    drag(within(popup).getByRole("slider", { name: "Shortest video" }), 100);
    expect(sentence()).toContain("59–60 min videos");
    drag(within(popup).getByRole("slider", { name: "Longest video" }), 1);
    expect(sentence()).toContain("59–60 min videos");
  });

  it("swaps typed values when the minimum is above the maximum", async () => {
    const popup = await openLearnPopup(lengthPhrase, "Video length");
    await typeRange(popup, LENGTH_BOXES, ["90", "10"]);
    expect(sentence()).toContain("10–90 min videos");
    expect(within(popup).getByRole("spinbutton", { name: LENGTH_BOXES[0] })).toHaveValue(10);
    expect(within(popup).getByRole("spinbutton", { name: LENGTH_BOXES[1] })).toHaveValue(90);
  });

  it("clamps typed values to its limits", async () => {
    const popup = await openLearnPopup(lengthPhrase, "Video length");
    await typeRange(popup, LENGTH_BOXES, ["0", "500"]);
    expect(sentence()).toContain("1–120 min videos");
  });

  it("rejects anything that isn't a whole number, and keeps the old range", async () => {
    const popup = await openLearnPopup(lengthPhrase, "Video length");
    await typeRange(popup, LENGTH_BOXES, ["", "12.5"]);
    expect(within(popup).getByText("Enter whole numbers of minutes.")).toBeInTheDocument();
    expect(sentence()).toContain("10–60 min videos");

    await typeRange(popup, LENGTH_BOXES, ["5", "60"]);
    expect(within(popup).queryByText("Enter whole numbers of minutes.")).not.toBeInTheDocument();
    expect(sentence()).toContain("5–60 min videos");
  });

  it("rejects letters with a message", async () => {
    const popup = await openLearnPopup(lengthPhrase, "Video length");
    const box = within(popup).getByRole("spinbutton", { name: LENGTH_BOXES[0] });
    await userEvent.clear(box);
    await userEvent.type(box, "abc{Enter}");
    expect(within(popup).getByText("Enter whole numbers of minutes.")).toBeInTheDocument();
    expect(sentence()).toContain("10–60 min videos");
  });

  it("drops a rejected value once the slider moves", async () => {
    const popup = await openLearnPopup(lengthPhrase, "Video length");
    const box = within(popup).getByRole("spinbutton", { name: LENGTH_BOXES[0] });
    await userEvent.clear(box);
    await userEvent.type(box, "abc{Enter}");
    drag(within(popup).getByRole("slider", { name: "Shortest video" }), 15);
    expect(within(popup).queryByText("Enter whole numbers of minutes.")).not.toBeInTheDocument();
    expect(box).toHaveValue(15);
  });

  it("applies a typed value when focus leaves the boxes", async () => {
    const popup = await openLearnPopup(lengthPhrase, "Video length");
    const box = within(popup).getByRole("spinbutton", { name: LENGTH_BOXES[1] });
    await userEvent.clear(box);
    await userEvent.type(box, "45");
    expect(sentence()).toContain("10–60 min videos");
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    expect(sentence()).toContain("10–45 min videos");
  });

  it("is reachable from the keyboard", async () => {
    renderFeeds();
    await feedTitles();
    lengthPhrase().focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Video length" })).toBeInTheDocument();
  });
});

describe("the session time popup", () => {
  it("fits Up next to the session maximum while dragging", async () => {
    const popup = await openLearnPopup(sessionPhrase, "Session time");
    drag(within(popup).getByRole("slider", { name: "Maximum session time" }), 40);
    expect(await feedTitles()).toHaveLength(2);
    expect(sentence()).toContain("30–40 min sessions");
    expect(screen.getByRole("dialog", { name: "Session time" })).toBe(popup);
  });

  it("swaps and clamps typed values", async () => {
    const popup = await openLearnPopup(sessionPhrase, "Session time");
    await typeRange(popup, SESSION_BOXES, ["999", "5"]);
    expect(sentence()).toContain("10–240 min sessions");
  });

  it("shows the amber warning while the session is short of the minimum", async () => {
    const popup = await openLearnPopup(sessionPhrase, "Session time");
    expect(upNextLine()).not.toHaveTextContent("short of your minimum");

    await typeRange(popup, SESSION_BOXES, ["70", "90"]);
    expect(upNextLine()).toHaveTextContent("10m short of your minimum");

    await typeRange(popup, SESSION_BOXES, ["60", "90"]);
    expect(upNextLine()).not.toHaveTextContent("short of your minimum");
  });

  it("keeps the new range after a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderFeeds(storage);
    await feedTitles();
    await userEvent.click(sessionPhrase());
    await typeRange(screen.getByRole("dialog", { name: "Session time" }), SESSION_BOXES, ["20", "50"]);
    unmount();

    renderFeeds(storage);
    expect(sentence()).toContain("20–50 min sessions");
  });
});
