import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FEEDS_CATALOG } from "./test/feedsCatalog";
import { feedTitles, filtersButton, renderApp, toggleFilters } from "./test/renderApp";

const renderFeeds = () => renderApp({ loadCatalog: async () => FEEDS_CATALOG });

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const settingsLine = () => screen.getByRole("group", { name: "Feed settings" });
const undoButton = () => screen.queryByRole("button", { name: /^Undo last change/ });
const redoButton = () => screen.queryByRole("button", { name: /^Redo the change you undid/ });
/** The open feed's title. */
const feedTitle = (name: string) => screen.queryByRole("heading", { level: 2, name });

async function openTab(name: string) {
  await userEvent.click(within(tabBar()).getByRole("button", { name }));
}

async function openTopicsPopup(name = "Topics in this feed") {
  await userEvent.click(within(settingsLine()).getByRole("button", { name: /(topics?|channels?|hidden)$/ }));
  return screen.getByRole("dialog", { name });
}

async function clickIn(popup: HTMLElement, name: string) {
  await userEvent.click(within(popup).getByRole("button", { name }));
}

async function undo() {
  const button = undoButton();
  if (!button) throw new Error("No undo button");
  await userEvent.click(button);
}

async function redo() {
  const button = redoButton();
  if (!button) throw new Error("No redo button");
  await userEvent.click(button);
}

/** Hides and shows Economics on Learn, `times` changes in all. */
async function toggleEconomics(times: number) {
  const popup = await openTopicsPopup();
  for (let i = 0; i < times; i++) {
    await clickIn(popup, i % 2 === 0 ? "Hide Economics from this feed" : "Show Economics again");
  }
  await userEvent.keyboard("{Escape}");
}

describe("undo and redo", () => {
  it("shows neither button until a setting changes", async () => {
    renderFeeds();
    await openTab("Learn");
    expect(await feedTitles()).toContain("Fresh agent build");
    expect(undoButton()).not.toBeInTheDocument();
    expect(redoButton()).not.toBeInTheDocument();
  });

  it("undo restores the previous topics and Up next; redo reapplies the change", async () => {
    renderFeeds();
    await openTab("Learn");
    const popup = await openTopicsPopup();
    await clickIn(popup, "Remove AI");
    await userEvent.keyboard("{Escape}");
    expect(await feedTitles()).not.toContain("Fresh agent build");

    await undo();
    expect(await feedTitles()).toContain("Fresh agent build");
    expect(within(settingsLine()).getByRole("button", { name: "4 topics" })).toBeInTheDocument();
    expect(undoButton()).not.toBeInTheDocument();

    await redo();
    expect(await feedTitles()).not.toContain("Fresh agent build");
    expect(within(settingsLine()).getByRole("button", { name: "3 topics" })).toBeInTheDocument();
    expect(redoButton()).not.toBeInTheDocument();
    expect(undoButton()).toBeInTheDocument();
  });

  it("undoes hiding a topic and editing channels", async () => {
    renderFeeds();
    await openTab("Learn");
    await toggleEconomics(1);
    expect(await feedTitles()).toEqual(["Fresh agent build"]);
    await undo();
    expect((await feedTitles()).sort()).toEqual(["Fresh agent build", "Learning economics", "Older ledger story"]);

    await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: /^Subscriptions/ }));
    const popup = await openTopicsPopup("Channels in this feed");
    await userEvent.type(within(popup).getByRole("textbox", { name: "Add a channel" }), "Tennis Today{Enter}");
    await userEvent.keyboard("{Escape}");
    expect(within(settingsLine()).getByRole("button", { name: "8 channels" })).toBeInTheDocument();

    await undo();
    expect(within(settingsLine()).getByRole("button", { name: "7 channels" })).toBeInTheDocument();
  });

  it("counts steps on badges, up to 10 each way", async () => {
    renderFeeds();
    await openTab("Learn");
    await toggleEconomics(2);
    expect(undoButton()).toHaveAccessibleName("Undo last change (2 steps)");
    expect(within(undoButton()!).getByText("2")).toBeInTheDocument();

    await toggleEconomics(10);
    expect(undoButton()).toHaveAccessibleName("Undo last change (10 steps)");

    for (let i = 0; i < 10; i++) await undo();
    expect(undoButton()).not.toBeInTheDocument();
    expect(redoButton()).toHaveAccessibleName("Redo the change you undid (10 steps)");
  });

  it("a new change after undo empties redo", async () => {
    renderFeeds();
    await openTab("Learn");
    await toggleEconomics(2);
    await undo();
    expect(redoButton()).toBeInTheDocument();

    const popup = await openTopicsPopup();
    await clickIn(popup, "Remove AI");
    expect(redoButton()).not.toBeInTheDocument();
    expect(undoButton()).toHaveAccessibleName("Undo last change (2 steps)");
  });

  it("brings you back to the feed it changes", async () => {
    renderFeeds();
    await openTab("Learn");
    const popup = await openTopicsPopup();
    await clickIn(popup, "Remove AI");
    await userEvent.keyboard("{Escape}");
    await openTab("Everything (home)");
    expect(feedTitle("Everything")).toBeInTheDocument();

    await undo();
    expect(feedTitle("Learn")).toBeInTheDocument();
    expect(feedTitle("Everything")).not.toBeInTheDocument();
    expect(await feedTitles()).toContain("Fresh agent build");
  });

  it("undoes a length range typed into the popup", async () => {
    renderFeeds();
    await openTab("Learn");
    await userEvent.click(within(settingsLine()).getByRole("button", { name: /^Video length/ }));
    const popup = screen.getByRole("dialog", { name: "Video length" });
    const longest = within(popup).getByRole("spinbutton", { name: "Longest video in minutes" });
    await userEvent.clear(longest);
    await userEvent.type(longest, "15{Enter}");
    await userEvent.keyboard("{Escape}");
    expect(await feedTitles()).toEqual([]);

    await undo();
    expect(await feedTitles()).toHaveLength(3);
    expect(within(settingsLine()).getByRole("button", { name: /^Video length/ })).toHaveTextContent("10–60 min");
  });

  it("counts one slider drag as one step", async () => {
    renderFeeds();
    await openTab("Learn");
    await userEvent.click(within(settingsLine()).getByRole("button", { name: /^Session time/ }));
    const slider = within(screen.getByRole("dialog", { name: "Session time" })).getByRole("slider", { name: /^Maximum/ });
    act(() => slider.focus());
    for (const value of [85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35]) fireEvent.change(slider, { target: { value: String(value) } });
    await userEvent.keyboard("{Escape}");
    expect(undoButton()).toHaveAccessibleName("Undo last change");

    await undo();
    expect(within(settingsLine()).getByRole("button", { name: /^Session time/ })).toHaveTextContent("30–90 min");
  });

  it("undoes a filter change", async () => {
    renderFeeds();
    await openTab("Learn");
    const before = filtersButton().textContent;
    await toggleFilters("Hide clickbait");
    expect(filtersButton().textContent).not.toBe(before);

    await undo();
    expect(filtersButton().textContent).toBe(before);
  });

  it("leaves tab switches out of the steps", async () => {
    renderFeeds();
    await openTab("Learn");
    await openTab("Everything (home)");
    expect(undoButton()).not.toBeInTheDocument();
  });

  it("is reachable from the keyboard", async () => {
    renderFeeds();
    await openTab("Learn");
    const popup = await openTopicsPopup();
    await clickIn(popup, "Remove AI");
    await userEvent.keyboard("{Escape}");

    undoButton()!.focus();
    await userEvent.keyboard("{Enter}");
    expect(await feedTitles()).toContain("Fresh agent build");
    // The last undo hides its button, so focus moves to redo instead of being lost.
    expect(redoButton()).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(await feedTitles()).not.toContain("Fresh agent build");
    expect(undoButton()).toHaveFocus();
  });

  it("starts empty again after Reset demo", async () => {
    renderFeeds();
    await openTab("Learn");
    await toggleEconomics(1);
    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(undoButton()).not.toBeInTheDocument();
  });
});
