import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Video } from "./domain/types";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { CATALOG, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, renderApp, settingsLine } from "./test/renderApp";

const MCP: Video = { ...CATALOG[1], id: "mcp-1", title: "Wiring tools over MCP", honestTitle: "Wiring tools over MCP", topic: "MCP", channel: "Agent Workshop" };
const PASTA: Video = { ...CATALOG[1], id: "pasta-1", title: "Fresh pasta", honestTitle: "Fresh pasta", topic: "Cooking", channel: "Kitchen", minutes: 10 };
const loadCatalog = async () => [...CATALOG, MCP, PASTA];

/** Saved demo state with `feed` open. */
const openOn = (feed: string) => {
  const saved = toSaved(DEMO_SEED);
  return memoryStorage({ ...saved, state: { ...saved.state, currentFeed: feed } });
};

const LABEL = "Outside your recipe: MCP, next to AI";

async function flipOutsideSlot() {
  await userEvent.click(within(settingsLine()).getByRole("button", { name: "Tab options" }));
  await userEvent.click(await screen.findByRole("switch", { name: "Outside your recipe" }));
  await userEvent.keyboard("{Escape}");
}

describe("Outside your recipe", () => {
  it("puts one labelled video from an adjacent topic in Up next", async () => {
    renderApp({ loadCatalog, storage: openOn("Learn") });
    expect(await cardFor(MCP.title)).toHaveTextContent(LABEL);
    expect(screen.getAllByText(/^Outside your recipe/)).toHaveLength(1);
  });

  it("turns off for that feed only, and stays off after a reload", async () => {
    const storage = openOn("Learn");
    const { unmount } = renderApp({ loadCatalog, storage });
    await cardFor(MCP.title);
    await flipOutsideSlot();
    expect(await feedTitles()).not.toContain(MCP.title);
    unmount();

    renderApp({ loadCatalog, storage });
    expect(await feedTitles()).not.toContain(MCP.title);
    await userEvent.click(within(settingsLine()).getByRole("button", { name: "Tab options" }));
    expect(await screen.findByRole("switch", { name: "Outside your recipe" })).toHaveAttribute("aria-checked", "false");
    const saved = storage.saved() as { state: { feeds: { name: string; exploreSlot: boolean }[] } };
    expect(saved.state.feeds.filter((f) => !f.exploreSlot).map((f) => f.name)).toEqual(["Learn"]);
  });

  it("is on for feeds saved before the slot existed", async () => {
    const saved = toSaved(DEMO_SEED);
    const feeds = saved.state.feeds.map(({ exploreSlot: _, ...f }) => f);
    renderApp({ loadCatalog, storage: memoryStorage({ ...saved, state: { ...saved.state, feeds, currentFeed: "Learn" } }) });
    expect(await cardFor(MCP.title)).toHaveTextContent(LABEL);
  });

  it("shows none on a feed with no adjacent topic", async () => {
    renderApp({ loadCatalog, storage: openOn("Cooking") });
    expect(await feedTitles()).toEqual([PASTA.title]);
    expect(screen.queryByText(/^Outside your recipe/)).not.toBeInTheDocument();
  });

  it("has no switch on feeds without the slot", async () => {
    renderApp({ loadCatalog });
    await feedTitles();
    await userEvent.click(within(settingsLine()).getByRole("button", { name: "Tab options" }));
    expect(screen.queryByRole("switch", { name: "Outside your recipe" })).not.toBeInTheDocument();
  });
});
