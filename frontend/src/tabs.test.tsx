import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, openFeedTitle, renderApp } from "./test/renderApp";

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const tab = (name: string) => within(tabBar()).getByRole("button", { name });
const queryTab = (name: string) => within(tabBar()).queryByRole("button", { name });

/** Names of the tabs in the bar, in order, leaving out their close and pin buttons. */
const tabNames = () =>
  within(tabBar())
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "")
    .filter((n) => !n.startsWith("Close ") && !n.startsWith("Keep "));

async function newFeed(name?: string) {
  await userEvent.click(screen.getByRole("button", { name: "New feed" }));
  if (name === undefined) return;
  await userEvent.type(screen.getByRole("textbox", { name: "Feed name" }), `${name}{Enter}`);
}

const openAllTabs = () => userEvent.click(screen.getByRole("button", { name: "All tabs" }));
/** The button on a feed's All tabs card that opens it. */
const allTabsCard = (name: string) => within(screen.getByRole("region", { name: "All tabs" })).getByRole("button", { name });
const allTabsSection = (name: "In the tab bar" | "Only in All tabs") => screen.getByRole("region", { name });
const namesIn = (name: "In the tab bar" | "Only in All tabs") =>
  within(allTabsSection(name))
    .queryAllByRole("heading", { level: 4 })
    .map((h) => h.textContent);

async function openTabOptions() {
  await userEvent.click(screen.getByRole("button", { name: "Tab options" }));
  return screen.getByRole("dialog", { name: "Tab options" });
}

describe("new feeds", () => {
  it("+ opens a draft with a Name this feed box, and naming it makes a tab", async () => {
    renderApp();
    await newFeed();

    expect(tab("New feed")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("textbox", { name: "Feed name" })).toHaveAttribute("placeholder", "Name this feed");

    await userEvent.type(screen.getByRole("textbox", { name: "Feed name" }), "Gardening{Enter}");
    expect(tab("Gardening")).toHaveAttribute("aria-current", "page");
    expect(queryTab("New feed")).not.toBeInTheDocument();
    expect(openFeedTitle()).toBe("Gardening");
    expect(screen.queryByRole("textbox", { name: "Feed name" })).not.toBeInTheDocument();
  });

  it("drops an unused draft when you leave it", async () => {
    renderApp();
    await newFeed();
    await userEvent.click(tab("Learn"));

    expect(queryTab("New feed")).not.toBeInTheDocument();
    await openAllTabs();
    expect([...namesIn("In the tab bar"), ...namesIn("Only in All tabs")]).not.toContain("New feed");
  });

  it("forgets an unnamed draft across a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await newFeed();
    unmount();

    renderApp({ storage });
    expect(queryTab("New feed")).not.toBeInTheDocument();
    expect(openFeedTitle()).toBe("Everything");
  });

  it.each([
    ["news", '"news" is a built-in tab. Pick a different name.'],
    ["MOST VIEWED", '"MOST VIEWED" is a built-in tab. Pick a different name.'],
    ["learn", "You already have a feed with that name."],
    ["   ", "Type a name first."],
    ["A name far too long for one tab", "Keep it under 25 characters."],
  ])("refuses the name %j", async (name, message) => {
    renderApp();
    await newFeed(name);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(tab("New feed")).toHaveAttribute("aria-current", "page");
  });
});

describe("closing tabs", () => {
  it("shows a close button on every tab but Home", async () => {
    renderApp();
    expect(tab("Close Learn")).toBeInTheDocument();
    expect(tab("Close Sport")).toBeInTheDocument();
    expect(within(tabBar()).queryByRole("button", { name: /^Close Everything/ })).not.toBeInTheDocument();
  });

  it("shelves the tab instead of deleting it", async () => {
    renderApp();
    await userEvent.click(tab("Close Learn"));

    expect(queryTab("Learn")).not.toBeInTheDocument();
    expect(openFeedTitle()).toBe("Everything");
    await openAllTabs();
    expect(namesIn("Only in All tabs")).toContain("Learn");
  });

  it("closing the open tab lands on its right neighbour, else its left, else Home", async () => {
    renderApp();
    await userEvent.click(tab("Learn"));
    await userEvent.click(tab("Close Learn"));
    expect(openFeedTitle()).toBe("Sport");

    await newFeed("Gardening");
    await userEvent.click(tab("Close Gardening"));
    expect(openFeedTitle()).toBe("Sport");

    await userEvent.click(tab("Close Sport"));
    expect(openFeedTitle()).toBe("Everything");
  });

  it("the close button follows its tab in keyboard order", async () => {
    renderApp();
    tab("Learn").focus();
    await userEvent.tab();
    expect(tab("Close Learn")).toHaveFocus();
  });
});

describe("the All tabs page", () => {
  it("splits feeds into the tab bar and All tabs, counting spaces", async () => {
    renderApp();
    await openAllTabs();

    expect(screen.getByRole("heading", { level: 2, name: "All tabs" })).toBeInTheDocument();
    expect(within(allTabsSection("In the tab bar")).getByText(/4 of 8 spaces/)).toBeInTheDocument();
    expect(namesIn("In the tab bar")).toEqual(["Everything", "Subscriptions", "Most viewed", "News", "Shared with you", "Learn", "Sport"]);
    expect(namesIn("Only in All tabs")).toEqual(["Wind down", "Cooking"]);
  });

  it("keeps Home in the tab bar", async () => {
    renderApp();
    await openAllTabs();
    expect(screen.queryByRole("button", { name: "Move Everything to All tabs" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Minimize All tabs" }));
    const popup = await openTabOptions();
    expect(within(popup).queryByRole("button", { name: "Move to All tabs" })).not.toBeInTheDocument();
  });

  it("moves a feed either way in one click", async () => {
    renderApp();
    await openAllTabs();

    await userEvent.click(screen.getByRole("button", { name: "Add Cooking to the tab bar" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Learn to All tabs" }));

    expect(namesIn("Only in All tabs")).toEqual(["Learn", "Wind down"]);
    expect(tabNames()).toContain("Cooking");
    expect(tabNames()).not.toContain("Learn");
  });

  it("refuses a 9th space: The tab bar is full", async () => {
    renderApp();
    for (const name of ["A", "B", "C", "D"]) await newFeed(name);
    await openAllTabs();
    expect(within(allTabsSection("In the tab bar")).getByText(/8 of 8 spaces/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add Cooking to the tab bar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("The tab bar is full");
    expect(namesIn("Only in All tabs")).toContain("Cooking");
  });

  it("a shelved feed opens temporarily in the bar with a pin that keeps it there", async () => {
    renderApp();
    await openAllTabs();
    await userEvent.click(allTabsCard("Cooking"));

    expect(openFeedTitle()).toBe("Cooking");
    expect(tab("Cooking")).toHaveAttribute("aria-current", "page");
    expect(queryTab("Close Cooking")).not.toBeInTheDocument();

    await userEvent.click(tab("Keep Cooking in the tab bar"));
    expect(queryTab("Keep Cooking in the tab bar")).not.toBeInTheDocument();
    expect(tab("Close Cooking")).toBeInTheDocument();
  });

  it("a temporary tab goes away when you open another feed", async () => {
    renderApp();
    await openAllTabs();
    await userEvent.click(allTabsCard("Cooking"));
    await userEvent.click(tab("Learn"));

    expect(queryTab("Cooking")).not.toBeInTheDocument();
  });
});

describe("the Tab options popup", () => {
  it("moves the open feed to All tabs and back, staying on it", async () => {
    renderApp();
    await userEvent.click(tab("Learn"));
    await userEvent.click(within(await openTabOptions()).getByRole("button", { name: "Move to All tabs" }));

    expect(openFeedTitle()).toBe("Learn");
    expect(tab("Keep Learn in the tab bar")).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole("dialog", { name: "Tab options" })).getByRole("button", { name: "Show in tab bar" }));
    expect(tab("Close Learn")).toBeInTheDocument();
  });

  it("deletes your own feed after you confirm", async () => {
    renderApp();
    await userEvent.click(tab("Learn"));
    const popup = await openTabOptions();

    await userEvent.click(within(popup).getByRole("button", { name: "Delete tab" }));
    expect(within(popup).getByText(`Delete "Learn"? This can't be undone.`)).toBeInTheDocument();
    await userEvent.click(within(popup).getByRole("button", { name: "Cancel" }));
    expect(tab("Learn")).toBeInTheDocument();

    await userEvent.click(within(popup).getByRole("button", { name: "Delete tab" }));
    await userEvent.click(within(popup).getByRole("button", { name: "Delete" }));

    expect(queryTab("Learn")).not.toBeInTheDocument();
    expect(openFeedTitle()).toBe("Sport");
    await openAllTabs();
    expect([...namesIn("In the tab bar"), ...namesIn("Only in All tabs")]).not.toContain("Learn");
  });

  it("offers built-in feeds shelving but never deletion", async () => {
    renderApp();
    await userEvent.click(within(tabBar()).getByRole("button", { name: "Explore feeds" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: /^News/ }));
    const popup = await openTabOptions();

    expect(within(popup).getByRole("button", { name: "Move to All tabs" })).toBeInTheDocument();
    expect(within(popup).queryByRole("button", { name: "Delete tab" })).not.toBeInTheDocument();
    expect(within(popup).getByText("Built-in tabs can be moved but not deleted.")).toBeInTheDocument();
  });

  it("refuses Show in tab bar when the bar is full", async () => {
    renderApp();
    for (const name of ["A", "B", "C", "D"]) await newFeed(name);
    await openAllTabs();
    await userEvent.click(allTabsCard("Cooking"));
    const popup = await openTabOptions();

    await userEvent.click(within(popup).getByRole("button", { name: "Show in tab bar" }));
    expect(within(popup).getByText(/The tab bar is full/)).toBeInTheDocument();
    expect(tab("Keep Cooking in the tab bar")).toBeInTheDocument();
  });
});

describe("reordering your tabs", () => {
  it("moves a tab with the Tab options buttons, and the order survives a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await userEvent.click(tab("Sport"));
    await userEvent.click(within(await openTabOptions()).getByRole("button", { name: "Move left" }));
    expect(tabNames().slice(-2)).toEqual(["Sport", "Learn"]);

    unmount();
    renderApp({ storage });
    await feedTitles();
    expect(tabNames().slice(-2)).toEqual(["Sport", "Learn"]);
  });

  it("only offers the moves that exist", async () => {
    renderApp();
    await userEvent.click(tab("Learn"));
    const popup = await openTabOptions();
    expect(within(popup).queryByRole("button", { name: "Move left" })).not.toBeInTheDocument();
    expect(within(popup).getByRole("button", { name: "Move right" })).toBeInTheDocument();
  });

  it("drags one of your tabs onto another", async () => {
    renderApp();
    await newFeed("Gardening");
    const dataTransfer = { setData: () => {}, effectAllowed: "", dropEffect: "" };

    fireEvent.dragStart(tab("Gardening"), { dataTransfer });
    fireEvent.dragOver(tab("Learn"), { dataTransfer });
    fireEvent.drop(tab("Learn"), { dataTransfer });

    expect(tabNames().slice(-3)).toEqual(["Gardening", "Learn", "Sport"]);
  });
});
