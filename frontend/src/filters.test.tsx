import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Video } from "./domain/types";
import { CARDS_CATALOG, CATALOG } from "./test/fixtures";
import { cardFor, feedTitles, filtersButton, renderApp, toggleFilters } from "./test/renderApp";

const filtersPopup = () => screen.findByRole("dialog", { name: "Filters and display" });
const filtersPhrase = () => filtersButton().textContent;

describe("the filters popup", () => {
  it("lists the six filters as switches, with the starting example's four on", async () => {
    renderApp();
    await feedTitles();
    await userEvent.click(filtersButton());

    const switches = within(await filtersPopup()).getAllByRole("switch");
    expect(switches.map((s) => [s.textContent, s.getAttribute("aria-checked")])).toEqual([
      ["Hide clickbait", "true"],
      ["Honest titles", "true"],
      ["Hide view counts", "true"],
      ["Hide subscriber counts", "false"],
      ["Boost small creators", "true"],
      ["Include Shorts", "false"],
    ]);
  });

  it("counts the filters that are on in the settings line", async () => {
    renderApp();
    await feedTitles();
    expect(filtersPhrase()).toBe("4 filters on");

    await toggleFilters("Hide clickbait");
    expect(filtersPhrase()).toBe("3 filters on");

    await toggleFilters("Honest titles", "Hide view counts", "Boost small creators");
    expect(filtersPhrase()).toBe("no filters");

    await toggleFilters("Include Shorts");
    expect(filtersPhrase()).toBe("1 filter on");
  });

  it("stays open while switches are flipped, so the feed updates behind it", async () => {
    renderApp();
    await feedTitles();
    await userEvent.click(filtersButton());
    await userEvent.click(within(await filtersPopup()).getByRole("switch", { name: "Hide clickbait" }));

    expect(await filtersPopup()).toBeInTheDocument();
    expect(await feedTitles()).toContain("A small AI tip");
  });

  it("works from the keyboard", async () => {
    renderApp();
    await feedTitles();
    filtersButton().focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();

    const hideClickbait = within(await filtersPopup()).getByRole("switch", { name: "Hide clickbait" });
    expect(hideClickbait).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(hideClickbait).toHaveAttribute("aria-checked", "false");

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Filters and display" })).not.toBeInTheDocument();
    expect(filtersButton()).toHaveFocus();
    expect(filtersPhrase()).toBe("3 filters on");
  });
});

describe("each filter", () => {
  it("Hide clickbait off lets clickbait videos in, under their honest titles", async () => {
    renderApp();
    expect(await feedTitles()).not.toContain("A small AI tip");

    await toggleFilters("Hide clickbait");
    expect(await feedTitles()).toContain("A small AI tip");
  });

  it("Honest titles off shows the bait title and the bait caption", async () => {
    renderApp({ loadCatalog: async () => CARDS_CATALOG });
    const honest = await cardFor("Planning your next five years");
    expect(within(honest).getByText("YOUR 5-YEAR PLAN")).toBeInTheDocument();

    await toggleFilters("Honest titles");
    const bait = await cardFor("The ONE career mistake everyone makes");
    expect(within(bait).getByText("DON'T DO THIS")).toBeInTheDocument();
    expect(within(bait).queryByText("YOUR 5-YEAR PLAN")).not.toBeInTheDocument();
    expect(await feedTitles()).not.toContain("Planning your next five years");
  });

  it("Hide view counts and Hide subscriber counts change the card details", async () => {
    const DATABASE = "Building a tiny database from scratch";
    renderApp({ loadCatalog: async () => CARDS_CATALOG });
    expect(within(await cardFor(DATABASE)).getByText("Byte Garden · 88K subs")).toBeInTheDocument();

    await toggleFilters("Hide view counts");
    expect(within(await cardFor(DATABASE)).getByText("Byte Garden · 88K subs · 1.9M views")).toBeInTheDocument();

    await toggleFilters("Hide subscriber counts");
    expect(within(await cardFor(DATABASE)).getByText("Byte Garden · 1.9M views")).toBeInTheDocument();
  });

  it("Include Shorts lets in videos under two minutes", async () => {
    const short = { ...CATALOG[1], id: "demo-54", title: "One-minute pruning tip", honestTitle: "One-minute pruning tip", minutes: 1 };
    renderApp({ loadCatalog: async () => [...CATALOG, short] });
    expect(await feedTitles()).not.toContain("One-minute pruning tip");

    await toggleFilters("Include Shorts");
    expect(await feedTitles()).toContain("One-minute pruning tip");
  });

  it("Boost small creators off stops putting small creators first on your own feeds", async () => {
    renderApp({ loadCatalog: async () => LEARN_CATALOG });
    await userEvent.click(within(screen.getByRole("navigation", { name: "Feeds" })).getByRole("button", { name: "Learn" }));
    expect((await feedTitles()).slice(0, 2).sort()).toEqual(["Small creator 1", "Small creator 2"]);

    await toggleFilters("Boost small creators");
    expect((await feedTitles()).slice(0, 2).sort()).not.toEqual(["Small creator 1", "Small creator 2"]);
  });
});

const learnVideo = (id: number, title: string, channelSubscribers: number): Video => ({
  ...CATALOG[1],
  id: `demo-${id}`,
  title,
  honestTitle: title,
  topic: "Programming",
  channelSubscribers,
});

/** Two small and two big Programming creators: Learn's 90-minute session fits all four 20-minute videos. */
const LEARN_CATALOG: readonly Video[] = [
  learnVideo(70, "Big creator 1", 2_000_000),
  learnVideo(71, "Big creator 2", 2_000_000),
  learnVideo(72, "Small creator 1", 5_000),
  learnVideo(73, "Small creator 2", 5_000),
];
