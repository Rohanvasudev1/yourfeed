import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { memoryStorage } from "./test/fixtures";
import { openFeedTitle, renderApp } from "./test/renderApp";

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const tab = (name: string) => within(tabBar()).getByRole("button", { name });
const queryTab = (name: string) => within(tabBar()).queryByRole("button", { name });
const editBar = () => screen.getByRole("region", { name: "Edit tabs" });
const editButton = (name: string) => within(editBar()).getByRole("button", { name });
const allTabs = () => screen.getByRole("region", { name: "All tabs" });
const allTabsCard = (name: string) => within(allTabs()).getByRole("button", { name });
const namesIn = (name: "In the tab bar" | "Only in All tabs") =>
  within(screen.getByRole("region", { name }))
    .queryAllByRole("heading", { level: 4 })
    .map((h) => h.textContent);

const startEditing = () => userEvent.click(screen.getByRole("button", { name: "Edit" }));
const openAllTabs = () => userEvent.click(screen.getByRole("button", { name: "All tabs" }));

async function select(...names: readonly string[]) {
  for (const name of names) await userEvent.click(tab(name));
}

async function newFeed(name: string) {
  await userEvent.click(screen.getByRole("button", { name: "New feed" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Feed name" }), `${name}{Enter}`);
}

describe("edit mode", () => {
  it("Edit puts a check on every tab, Explore's feeds included, and Done ends it", async () => {
    renderApp();
    await startEditing();

    expect(editBar()).toHaveTextContent("Select tabs, or drag them to reorder");
    for (const name of ["Everything (home)", "Subscriptions", "Most viewed", "News", "Learn", "Sport"]) {
      expect(tab(name)).toHaveAttribute("aria-pressed", "false");
    }
    expect(queryTab("Close Learn")).not.toBeInTheDocument();

    await select("Learn", "News");
    expect(tab("Learn")).toHaveAttribute("aria-pressed", "true");
    expect(editBar()).toHaveTextContent("2 selected");
    expect(openFeedTitle()).toBe("Everything");

    await select("News");
    expect(editBar()).toHaveTextContent("1 selected");

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("region", { name: "Edit tabs" })).not.toBeInTheDocument();
    expect(tab("Learn")).not.toHaveAttribute("aria-pressed");
    expect(tab("Explore feeds")).toBeInTheDocument();
  });

  it("moves several tabs to All tabs in one action", async () => {
    renderApp();
    await startEditing();
    await select("Learn", "Sport", "News");
    await userEvent.click(editButton("Move to All tabs"));

    expect(queryTab("Learn")).not.toBeInTheDocument();
    expect(queryTab("Sport")).not.toBeInTheDocument();
    expect(queryTab("News")).not.toBeInTheDocument();
    expect(editBar()).toHaveTextContent("Select tabs, or drag them to reorder");
  });

  it("keeps Home in the tab bar", async () => {
    renderApp();
    await startEditing();
    await select("Everything (home)", "Learn");
    await userEvent.click(editButton("Move to All tabs"));

    expect(within(editBar()).getByRole("alert")).toHaveTextContent("Everything always stays in the tab bar.");
    expect(tab("Learn")).toBeInTheDocument();
  });

  it("shows several shelved feeds in the tab bar from All tabs", async () => {
    renderApp();
    await openAllTabs();
    await startEditing();
    expect(
      within(allTabs()).queryByRole("button", {
        name: "Add Cooking to the tab bar",
      }),
    ).not.toBeInTheDocument();

    await userEvent.click(allTabsCard("Cooking"));
    await userEvent.click(allTabsCard("Wind down"));
    expect(allTabsCard("Cooking")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(editButton("Show in tab bar"));

    expect(namesIn("Only in All tabs")).toEqual([]);
    expect(tab("Cooking")).toBeInTheDocument();
    expect(tab("Wind down")).toBeInTheDocument();
  });

  it("offers Show in tab bar only on All tabs", async () => {
    renderApp();
    await startEditing();
    expect(within(editBar()).queryByRole("button", { name: "Show in tab bar" })).not.toBeInTheDocument();
  });

  it("refuses Show in tab bar past 8 spaces", async () => {
    renderApp();
    for (const name of ["A", "B", "C"]) await newFeed(name);
    await openAllTabs();
    await startEditing();
    await userEvent.click(allTabsCard("Cooking"));
    await userEvent.click(allTabsCard("Wind down"));
    await userEvent.click(editButton("Show in tab bar"));

    expect(within(editBar()).getByRole("alert")).toHaveTextContent("The tab bar holds 8 tabs. Move some to All tabs first.");
    expect(namesIn("Only in All tabs")).toEqual(["Wind down", "Cooking"]);
  });

  it("says to select a tab first when nothing is selected", async () => {
    renderApp();
    await startEditing();
    for (const action of ["Move to All tabs", "Delete"]) {
      await userEvent.click(editButton(action));
      expect(within(editBar()).getByRole("alert")).toHaveTextContent("Select at least one tab first.");
    }
  });

  it("drag to reorder still works", async () => {
    renderApp();
    await newFeed("Gardening");
    await startEditing();
    const dataTransfer = {
      setData: () => {},
      effectAllowed: "",
      dropEffect: "",
    };

    fireEvent.dragStart(tab("Gardening"), { dataTransfer });
    fireEvent.dragOver(tab("Learn"), { dataTransfer });
    fireEvent.drop(tab("Learn"), { dataTransfer });

    const own = within(tabBar())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(own.slice(-3)).toEqual(["Gardening", "Learn", "Sport"]);
  });

  it("New feed leaves edit mode", async () => {
    renderApp();
    await startEditing();
    await userEvent.click(screen.getByRole("button", { name: "New feed" }));

    expect(screen.queryByRole("region", { name: "Edit tabs" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Feed name" })).toBeInTheDocument();
  });
});

describe("bulk delete", () => {
  it("confirms, then removes the selected feeds", async () => {
    renderApp();
    await userEvent.click(tab("Learn"));
    await startEditing();
    await select("Learn", "Sport");

    await userEvent.click(editButton("Delete"));
    expect(editBar()).toHaveTextContent("Delete 2 tabs? This can't be undone.");
    await userEvent.click(editButton("Cancel"));
    expect(tab("Learn")).toBeInTheDocument();

    await userEvent.click(editButton("Delete"));
    await userEvent.click(editButton("Delete"));

    expect(queryTab("Learn")).not.toBeInTheDocument();
    expect(queryTab("Sport")).not.toBeInTheDocument();
    expect(openFeedTitle()).toBe("Everything");
    await openAllTabs();
    expect([...namesIn("In the tab bar"), ...namesIn("Only in All tabs")]).not.toContain("Learn");
  });

  it("says 1 tab for one", async () => {
    renderApp();
    await startEditing();
    await select("Sport");
    await userEvent.click(editButton("Delete"));
    expect(editBar()).toHaveTextContent("Delete 1 tab? This can't be undone.");
  });

  it("changing the selection drops the question", async () => {
    renderApp();
    await startEditing();
    await select("Sport");
    await userEvent.click(editButton("Delete"));
    await select("Learn");

    expect(editBar()).not.toHaveTextContent("This can't be undone.");
    expect(editBar()).toHaveTextContent("2 selected");
  });

  it("refuses built-in feeds by name", async () => {
    renderApp();
    await startEditing();
    await select("News", "Learn", "Most viewed");
    await userEvent.click(editButton("Delete"));

    expect(within(editBar()).getByRole("alert")).toHaveTextContent(
      "News, Most viewed can't be deleted. You can move them to All tabs instead.",
    );
    expect(editBar()).not.toHaveTextContent("This can't be undone.");
  });

  it("refuses one built-in feed as it", async () => {
    renderApp();
    await startEditing();
    await select("News");
    await userEvent.click(editButton("Delete"));

    expect(within(editBar()).getByRole("alert")).toHaveTextContent("News can't be deleted. You can move it to All tabs instead.");
  });

  it("keeps at least one feed", async () => {
    const onlyMine = {
      ...DEMO_SEED,
      feeds: DEMO_SEED.feeds.filter((f) => f.kind === "topics"),
      currentFeed: "Learn",
    };
    renderApp({ storage: memoryStorage(toSaved(onlyMine)) });
    await openAllTabs();
    await startEditing();
    for (const name of ["Learn", "Sport", "Wind down", "Cooking"]) await userEvent.click(allTabsCard(name));
    await userEvent.click(editButton("Delete"));

    expect(within(editBar()).getByRole("alert")).toHaveTextContent("Keep at least one feed.");
  });
});
