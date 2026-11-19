import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FEEDS_CATALOG, MOST_VIEWED_ORDER, NEWS_ORDER, SUBSCRIPTIONS_ORDER } from "./test/feedsCatalog";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp } from "./test/renderApp";

const renderFeeds = () => renderApp({ loadCatalog: async () => FEEDS_CATALOG });

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });

describe("your own feeds in the tab bar", () => {
  it("switching to Learn shows its topics from the last year, small creators first", async () => {
    renderFeeds();
    await userEvent.click(within(tabBar()).getByRole("button", { name: "Learn" }));

    expect(screen.getByRole("heading", { level: 2, name: "Learn" })).toBeInTheDocument();
    const [first, ...rest] = await feedTitles();
    expect(first).toBe("Learning economics");
    expect(rest.sort()).toEqual(["Fresh agent build", "Older ledger story"]);
  });

  it("switching to Sport shows only its topics, and the home tab goes back to Everything", async () => {
    renderFeeds();
    await userEvent.click(within(tabBar()).getByRole("button", { name: "Sport" }));
    expect(await feedTitles()).toEqual(["Five set final"]);

    await userEvent.click(within(tabBar()).getByRole("button", { name: "Everything (home)" }));
    expect(screen.getByRole("heading", { level: 2, name: "Everything" })).toBeInTheDocument();
  });

  it("marks the open tab as the current page", async () => {
    renderFeeds();
    const home = within(tabBar()).getByRole("button", { name: "Everything (home)" });
    expect(home).toHaveAttribute("aria-current", "page");

    const sport = within(tabBar()).getByRole("button", { name: "Sport" });
    await userEvent.click(sport);
    expect(sport).toHaveAttribute("aria-current", "page");
    expect(home).not.toHaveAttribute("aria-current");
  });
});

const exploreButton = (name = "Explore feeds") => within(tabBar()).getByRole("button", { name });

async function openFromExplore(feed: string) {
  await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: new RegExp(`^${feed}`) }));
}

describe("the Explore menu", () => {
  it("groups the built-in feeds, each with a one-line description, and keeps them out of the tab bar", async () => {
    renderFeeds();
    expect(within(tabBar()).queryByRole("button", { name: "Subscriptions" })).not.toBeInTheDocument();

    await userEvent.click(exploreButton());
    const menu = screen.getByRole("dialog", { name: "Explore feeds" });
    expect(within(menu).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "SubscriptionsNewest from your channels",
      "Most viewedRanked by views",
      "NewsLatest from news channels",
      "BlendMixed with a friend",
    ]);
    expect(exploreButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the picked feed, then shows its name and icon on the button and a check in the menu", async () => {
    renderFeeds();
    await openFromExplore("Subscriptions");

    expect(screen.queryByRole("dialog", { name: "Explore feeds" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Subscriptions" })).toBeInTheDocument();
    expect(await feedTitles()).toEqual(SUBSCRIPTIONS_ORDER);

    const button = exploreButton("Subscriptions, Explore feeds");
    expect(button).toHaveTextContent("Subscriptions");
    expect(button.querySelector(".tabler-icon-user-check")).not.toBeNull();
    expect(button).toHaveAttribute("aria-current", "page");

    await userEvent.click(button);
    const menu = screen.getByRole("dialog", { name: "Explore feeds" });
    expect(within(menu).getByRole("button", { name: /^Subscriptions/ })).toHaveAttribute("aria-current", "page");
    expect(within(menu).getByRole("button", { name: /^News/ })).not.toHaveAttribute("aria-current");
  });

  it("goes back to plain Explore when you open one of your own feeds", async () => {
    renderFeeds();
    await openFromExplore("News");
    await userEvent.click(within(tabBar()).getByRole("button", { name: "Learn" }));
    expect(exploreButton()).not.toHaveAttribute("aria-current");
  });

  it("works from the keyboard and closes with Escape, returning focus to the button", async () => {
    renderFeeds();
    exploreButton().focus();
    await userEvent.keyboard("{Enter}");
    const menu = screen.getByRole("dialog", { name: "Explore feeds" });
    expect(menu).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Explore feeds" })).not.toBeInTheDocument();
    expect(exploreButton()).toHaveFocus();
  });

  it("closes when focus tabs out of it", async () => {
    renderFeeds();
    await userEvent.click(exploreButton());
    for (let i = 0; i < 4; i++) await userEvent.tab();
    expect(screen.queryByRole("dialog", { name: "Explore feeds" })).not.toBeInTheDocument();
    expect(within(tabBar()).getByRole("button", { name: "Learn" })).toHaveFocus();
  });

  it("closes when you click outside it", async () => {
    renderFeeds();
    await userEvent.click(exploreButton());
    await userEvent.click(screen.getByRole("heading", { level: 2, name: "Everything" }));
    expect(screen.queryByRole("dialog", { name: "Explore feeds" })).not.toBeInTheDocument();
  });
});

const upNextCards = async () => within(await screen.findByRole("list", { name: "Up next" })).getAllByRole("listitem");

describe("Most viewed", () => {
  it("ranks the last year by views with #1, #2… badges", async () => {
    renderFeeds();
    await openFromExplore("Most viewed");

    expect(await feedTitles()).toEqual(MOST_VIEWED_ORDER.year);
    const cards = await upNextCards();
    expect(cards[0]).toHaveTextContent("#1");
    expect(cards[1]).toHaveTextContent("#2");
    expect(screen.getByRole("button", { name: "Last year" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches range, and remembers it after visiting another feed and reloading", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage });
    await openFromExplore("Most viewed");

    await userEvent.click(screen.getByRole("button", { name: "Last 24 hours" }));
    expect(await feedTitles()).toEqual(MOST_VIEWED_ORDER.day);
    await userEvent.click(screen.getByRole("button", { name: "All time" }));
    expect(await feedTitles()).toEqual(MOST_VIEWED_ORDER.all);
    expect(screen.getByRole("button", { name: "All time" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(within(tabBar()).getByRole("button", { name: "Learn" }));
    expect(screen.queryByRole("group", { name: "Time range" })).not.toBeInTheDocument();
    unmount();

    renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage });
    await openFromExplore("Most viewed");
    expect(await feedTitles()).toEqual(MOST_VIEWED_ORDER.all);
  });
});

describe("News", () => {
  it("puts live coverage on top under a red LIVE badge, then newest first", async () => {
    renderFeeds();
    await openFromExplore("News");

    expect(await feedTitles()).toEqual(NEWS_ORDER);
    const [live, ...rest] = await upNextCards();
    expect(within(live).getByText("LIVE")).toHaveClass("thumb-live");
    rest.forEach((card) => expect(within(card).queryByText("LIVE")).not.toBeInTheDocument());
  });

  it("filters by category chip, and remembers the chip after visiting another feed and reloading", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage });
    await openFromExplore("News");
    const chips = screen.getByRole("group", { name: "News category" });
    expect(within(chips).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "World", "Business", "Tech", "Science"]);

    await userEvent.click(within(chips).getByRole("button", { name: "Tech" }));
    expect(await feedTitles()).toEqual(["Chip makers report"]);
    expect(within(chips).getByRole("button", { name: "Tech" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(chips).getByRole("button", { name: "Science" }));
    expect(await feedTitles()).toEqual([]);

    await userEvent.click(within(chips).getByRole("button", { name: "Business" }));
    await openFromExplore("Most viewed");
    await openFromExplore("News");
    expect(await feedTitles()).toEqual(["Markets open"]);
    unmount();

    renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage });
    await openFromExplore("News");
    expect(await feedTitles()).toEqual(["Markets open"]);
  });
});
