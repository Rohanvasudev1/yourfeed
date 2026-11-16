import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BIG_CATALOG, EVERYTHING_ORDER } from "./test/fixtures";
import { cardFor, feedTitles, renderApp, settingsLine } from "./test/renderApp";

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const openTab = (name: string) => userEvent.click(within(tabBar()).getByRole("button", { name }));

async function openFromExplore(feed: string) {
  await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: new RegExp(`^${feed}`) }));
}

/** Clicks a card's topic or channel word and returns the popup it opens. */
async function openWord(title: string, word: "Topic" | "Channel", value: string) {
  await userEvent.click(within(await cardFor(title)).getByRole("button", { name: `${word}: ${value}` }));
  return screen.getByRole("dialog", { name: value });
}

const clickIn = (popup: HTMLElement, name: string) => userEvent.click(within(popup).getByRole("button", { name }));

describe("a card's topic", () => {
  it("hides the topic here, and undo brings it back", async () => {
    renderApp();
    const popup = await openWord("Intro to transformers", "Topic", "AI");
    expect(popup).toHaveTextContent("Not one of this tab's topics · 4 videos");
    await clickIn(popup, "Hide AI here");
    expect(await feedTitles()).toEqual(["Gardening for beginners"]);

    await userEvent.click(screen.getByRole("button", { name: /^Undo last change/ }));
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
  });

  it("boosts the topic on Everything, then offers to stop", async () => {
    renderApp();
    await clickIn(await openWord("Gardening for beginners", "Topic", "Gardening"), "Boost Gardening");
    expect(settingsLine()).toHaveTextContent("1 boosted topic");
    expect(await openWord("Gardening for beginners", "Topic", "Gardening")).toHaveTextContent("Boosted in this tab");
  });
});

describe("a card's channel", () => {
  it("adds the channel to Subscriptions", async () => {
    renderApp();
    const popup = await openWord("Intro to transformers", "Channel", "Model School");
    expect(popup).toHaveTextContent("500K subscribers · 1 video here");
    await clickIn(popup, "Add to Subscriptions");

    await openFromExplore("Subscriptions");
    expect(await feedTitles()).toContain("Intro to transformers");
    expect(await openWord("Intro to transformers", "Channel", "Model School")).toHaveTextContent("You follow this channel");
  });
});

describe("Already watched", () => {
  it("takes the video off Everything and marks it Watched in other feeds", async () => {
    renderApp();
    const toggle = within(await cardFor("Intro to transformers")).getByRole("button", { name: "Mark Intro to transformers as watched" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    expect(await feedTitles()).not.toContain("Intro to transformers");

    await openTab("Learn");
    const card = await cardFor("Intro to transformers");
    expect(card).toHaveTextContent("Watched");
    await userEvent.click(within(card).getByRole("button", { name: "Mark Intro to transformers as watched", pressed: true }));
    expect(await cardFor("Intro to transformers")).not.toHaveTextContent("Watched");
  });
});

describe("Videos like this", () => {
  it("lists ten similar videos, and + adds one to the session first", async () => {
    renderApp({ loadCatalog: async () => BIG_CATALOG });
    const shown = await feedTitles();
    const [first] = shown;
    await userEvent.click(within(await cardFor(first)).getByRole("button", { name: `Videos like ${first}` }));
    const row = screen.getByRole("list", { name: `Videos like ${first}` });
    expect(within(row).getAllByRole("listitem")).toHaveLength(10);

    const extra = within(row)
      .getAllByRole("button", { name: /^Add .* to this session$/ })
      .map((b) => b.getAttribute("aria-label")!.replace(/^Add (.*) to this session$/, "$1"))
      .find((title) => !shown.includes(title))!;
    await userEvent.click(within(row).getByRole("button", { name: `Add ${extra} to this session` }));
    expect((await feedTitles())[0]).toBe(extra);
    expect(within(row).queryByRole("button", { name: `Add ${extra} to this session` })).toBeNull();
  });
});

describe("Remove from this session", () => {
  it("takes the video out of Up next", async () => {
    renderApp();
    await userEvent.click(
      within(await cardFor("Gardening for beginners")).getByRole("button", { name: "Remove Gardening for beginners from this session" }),
    );
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER.filter((t) => t !== "Gardening for beginners"));
  });
});
