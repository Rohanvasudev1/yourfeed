import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FEEDS_CATALOG } from "./test/feedsCatalog";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp } from "./test/renderApp";

const renderFeeds = () => renderApp({ loadCatalog: async () => FEEDS_CATALOG });

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const settingsLine = () => screen.getByRole("group", { name: "Feed settings" });
/** The settings line as read aloud, leaving out any popup open inside it. */
function sentence(): string {
  const line = settingsLine().cloneNode(true) as HTMLElement;
  line.querySelectorAll('[role="dialog"]').forEach((popup) => popup.remove());
  return (line.textContent ?? "").replace(/\s+/g, " ").trim();
}

async function openTab(name: string) {
  await userEvent.click(within(tabBar()).getByRole("button", { name }));
}

async function openFromExplore(feed: string) {
  await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: new RegExp(`^${feed}`) }));
}

describe("the settings line", () => {
  it("sums up one of your feeds: topics, lengths, sessions and filters", async () => {
    renderFeeds();
    await openTab("Learn");
    expect(sentence()).toBe("Showing 4 topics · 10–60 min videos · 30–90 min sessions · 4 filters on");
  });

  it("calls them boosted topics on Everything", async () => {
    renderFeeds();
    expect(sentence()).toMatch(/^Showing no boosted topics · /);
  });

  it("counts channels on Subscriptions and says all topics on Most viewed", async () => {
    renderFeeds();
    await openFromExplore("Subscriptions");
    expect(sentence()).toMatch(/^Showing 7 channels · /);

    await openFromExplore("Most viewed");
    expect(sentence()).toMatch(/^Showing all topics · /);
  });

  it("names the news category on News", async () => {
    renderFeeds();
    await openFromExplore("News");
    expect(sentence()).toMatch(/^Showing all news · /);

    await userEvent.click(within(screen.getByRole("group", { name: "News category" })).getByRole("button", { name: "Tech" }));
    expect(sentence()).toMatch(/^Showing Tech news · /);
    expect(within(settingsLine()).queryByRole("button", { name: /news/ })).not.toBeInTheDocument();
  });
});

const topicsButton = (name: RegExp | string = /topics?$/) => within(settingsLine()).getByRole("button", { name });
const topicsPopup = (name = "Topics in this feed") => screen.queryByRole("dialog", { name });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Longer than the popup's close delay. */
const CLOSE_WAIT_MS = 300;

describe("settings popups", () => {
  it("opens on hover and closes once the pointer leaves", async () => {
    renderFeeds();
    await openTab("Learn");
    expect(topicsPopup()).not.toBeInTheDocument();

    await userEvent.hover(topicsButton());
    expect(await screen.findByRole("dialog", { name: "Topics in this feed" })).toBeInTheDocument();
    expect(topicsButton()).toHaveAttribute("aria-expanded", "true");

    await userEvent.unhover(topicsButton());
    await waitFor(() => expect(topicsPopup()).not.toBeInTheDocument());
  });

  it("stays open when clicked, until clicked again", async () => {
    renderFeeds();
    await openTab("Learn");
    await userEvent.click(topicsButton());
    await userEvent.unhover(topicsButton());
    await pause(CLOSE_WAIT_MS);
    expect(topicsPopup()).toBeInTheDocument();

    await userEvent.click(topicsButton());
    expect(topicsPopup()).not.toBeInTheDocument();
  });

  it("closes on Escape and gives focus back to the phrase", async () => {
    renderFeeds();
    await openTab("Learn");
    await userEvent.click(topicsButton());
    await userEvent.keyboard("{Escape}");
    expect(topicsPopup()).not.toBeInTheDocument();
    expect(topicsButton()).toHaveFocus();
  });

  it("closes a hover-opened popup on Escape without moving focus", async () => {
    renderFeeds();
    await openTab("Learn");
    const learnTab = within(tabBar()).getByRole("button", { name: "Learn" });
    learnTab.focus();
    await userEvent.hover(topicsButton());
    await screen.findByRole("dialog", { name: "Topics in this feed" });
    await userEvent.keyboard("{Escape}");
    expect(topicsPopup()).not.toBeInTheDocument();
    expect(learnTab).toHaveFocus();
  });

  it("closes on a click outside", async () => {
    renderFeeds();
    await openTab("Learn");
    await userEvent.click(topicsButton());
    await userEvent.click(screen.getByRole("heading", { level: 2, name: "Learn" }));
    expect(topicsPopup()).not.toBeInTheDocument();
  });

  it("stays open while focus is inside it, even after the pointer leaves", async () => {
    renderFeeds();
    await openTab("Learn");
    await userEvent.hover(topicsButton());
    const popup = await screen.findByRole("dialog", { name: "Topics in this feed" });
    await userEvent.click(within(popup).getByRole("textbox", { name: "Add a topic" }));
    await userEvent.unhover(popup);
    await pause(CLOSE_WAIT_MS);
    expect(topicsPopup()).toBeInTheDocument();
  });

  it("is reachable from the keyboard", async () => {
    renderFeeds();
    await openTab("Learn");
    topicsButton().focus();
    await userEvent.keyboard("{Enter}");
    expect(topicsPopup()).toBeInTheDocument();
  });
});

async function openTopicsPopup(name = "Topics in this feed") {
  await userEvent.click(topicsButton(/(topics?|channels?|hidden)$/));
  return screen.getByRole("dialog", { name });
}

async function addItem(popup: HTMLElement, label: string, text: string) {
  await userEvent.type(within(popup).getByRole("textbox", { name: label }), `${text}{Enter}`);
}

describe("the topics popup", () => {
  it("adds a topic, and Up next shows its videos straight away", async () => {
    renderFeeds();
    await openTab("Learn");
    expect(await feedTitles()).not.toContain("Five set final");

    const popup = await openTopicsPopup();
    await addItem(popup, "Add a topic", "tennis");

    expect(within(popup).getByRole("button", { name: "Remove Tennis" })).toBeInTheDocument();
    expect(await feedTitles()).toContain("Five set final");
    expect(sentence()).toMatch(/^Showing 5 topics/);
  });

  it("removes a topic, and its videos leave Up next", async () => {
    renderFeeds();
    await openTab("Learn");
    expect(await feedTitles()).toContain("Fresh agent build");

    const popup = await openTopicsPopup();
    await userEvent.click(within(popup).getByRole("button", { name: "Remove AI" }));

    expect(await feedTitles()).not.toContain("Fresh agent build");
    expect(sentence()).toMatch(/^Showing 3 topics/);
  });

  it("hides a topic, crossed out with a way to show it again", async () => {
    renderFeeds();
    await openTab("Learn");
    const popup = await openTopicsPopup();

    await userEvent.click(within(popup).getByRole("button", { name: "Hide Economics from this feed" }));
    expect(await feedTitles()).toEqual(["Fresh agent build"]);
    expect(sentence()).toMatch(/^Showing 3 topics, 1 hidden/);
    expect(within(popup).queryByRole("button", { name: "Remove Economics" })).not.toBeInTheDocument();

    await userEvent.click(within(popup).getByRole("button", { name: "Show Economics again" }));
    expect((await feedTitles()).sort()).toEqual(["Fresh agent build", "Learning economics", "Older ledger story"]);
    expect(sentence()).toMatch(/^Showing 4 topics ·/);
  });

  it("says so when the topic is already in the feed, and changes nothing", async () => {
    renderFeeds();
    await openTab("Learn");
    const popup = await openTopicsPopup();

    await addItem(popup, "Add a topic", "ai");
    expect(within(popup).getByText("Already in this feed.")).toBeInTheDocument();
    expect(within(popup).getAllByRole("button", { name: "Remove AI" })).toHaveLength(1);
    expect(sentence()).toMatch(/^Showing 4 topics/);
  });

  it("asks for a topic when the box is empty", async () => {
    renderFeeds();
    await openTab("Learn");
    const popup = await openTopicsPopup();
    await userEvent.click(within(popup).getByRole("button", { name: "Add" }));
    expect(within(popup).getByText("Type a topic first.")).toBeInTheDocument();
  });

  it("edits channels on Subscriptions", async () => {
    renderFeeds();
    await openFromExplore("Subscriptions");
    const popup = await openTopicsPopup("Channels in this feed");

    await userEvent.click(within(popup).getByRole("button", { name: "Remove Agent Workshop" }));
    expect(await feedTitles()).not.toContain("Fresh agent build");

    await addItem(popup, "Add a channel", "Tennis Today");
    expect(await feedTitles()).toContain("Five set final");
    expect(sentence()).toMatch(/^Showing 7 channels/);
  });

  it("boosts topics on Everything", async () => {
    renderFeeds();
    const popup = await openTopicsPopup("Boost topics");
    await addItem(popup, "Add a topic", "Tennis");
    expect(sentence()).toMatch(/^Showing 1 boosted topic ·/);
    expect(within(popup).getByRole("button", { name: "Remove Tennis" })).toBeInTheDocument();
  });

  it("hiding Most viewed's only topic shows every other topic, not nothing", async () => {
    renderFeeds();
    await openFromExplore("Most viewed");
    const popup = await openTopicsPopup("Limit to topics");
    await addItem(popup, "Add a topic", "Tennis");
    expect(await feedTitles()).toEqual(["Five set final"]);

    await userEvent.click(within(popup).getByRole("button", { name: "Hide Tennis from this feed" }));
    expect(sentence()).toMatch(/^Showing all topics, 1 hidden ·/);
    expect(await feedTitles()).toEqual(["Learning economics", "Storm update", "Older ledger story", "Markets open", "Chip makers report", "Fresh agent build"]);
  });

  it("keeps the edits after a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage });
    await openTab("Learn");
    await userEvent.click(within(await openTopicsPopup()).getByRole("button", { name: "Hide AI from this feed" }));
    unmount();

    renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage });
    expect(sentence()).toMatch(/^Showing 3 topics, 1 hidden/);
  });
});
