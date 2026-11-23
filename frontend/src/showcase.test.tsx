import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Video } from "./domain/types";
import { actionsResult, scriptedAssistant } from "./test/assistant";
import { CATALOG, memoryStorage } from "./test/fixtures";
import { renderApp, upNextList } from "./test/renderApp";

const economics = (n: number): Video => ({
  ...CATALOG[1],
  id: `econ-${n}`,
  title: `Money lesson ${n}`,
  honestTitle: `Money lesson ${n}`,
  topic: "Economics",
  channel: "Money Desk",
});
const MCP: Video = { ...CATALOG[1], id: "mcp-1", title: "Wiring tools over MCP", honestTitle: "Wiring tools over MCP", topic: "MCP", channel: "Agent Workshop" };
const SHOWCASE_CATALOG: readonly Video[] = [...CATALOG, MCP, economics(1), economics(2), economics(3)];
const loadCatalog = async () => SHOWCASE_CATALOG;

const goTo = (path: string) => window.history.pushState(null, "", path);

beforeEach(() => {
  goTo("/about");
  // jsdom has no layout to scroll.
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => {
  goTo("/");
  vi.restoreAllMocks();
});

const showcase = () => screen.findByRole("heading", { level: 1, name: /recipe/i });
const live = (name: string) => screen.findByRole("region", { name });
const recipeLine = async () => within(await live("Live recipe")).getByText(/min sessions$/).closest("p")?.textContent ?? "";

describe("the showcase page at /about", () => {
  it("argues the four design ideas", async () => {
    renderApp({ loadCatalog });
    await showcase();
    for (const idea of ["The recipe is a contract", "The recipe mirror", "Outside your recipe", "Personalised by declaration, not profiling"]) {
      expect(screen.getByRole("heading", { level: 2, name: idea })).toBeInTheDocument();
    }
  });

  it("edits the live recipe from the Claude bar, logs the request and undoes it", async () => {
    const assistant = scriptedAssistant(() => actionsResult({ type: "set_topics", add: ["Cooking"], remove: [] }));
    renderApp({ loadCatalog, assistant });
    const demo = await live("Live recipe");
    expect(await recipeLine()).not.toContain("Cooking");

    await userEvent.type(within(demo).getByRole("textbox", { name: "Tell Claude what to change" }), "add cooking");
    await userEvent.click(within(demo).getByRole("button", { name: "Send to Claude" }));

    expect(await within(demo).findByRole("region", { name: "Recipe log" })).toHaveTextContent("add cooking → added Cooking");
    expect(await recipeLine()).toContain("Cooking");
    expect(assistant.calls[0].context.name).toBe("Learn");

    await userEvent.click(within(demo).getByRole("button", { name: /^Undo last change/ }));
    expect(await recipeLine()).not.toContain("Cooking");
    expect(within(demo).getByRole("region", { name: "Recipe log" })).toHaveTextContent("Undone: add cooking");
  });

  it("keeps its demo apart from your own feeds", async () => {
    const storage = memoryStorage();
    renderApp({ loadCatalog, storage, assistant: scriptedAssistant(() => actionsResult({ type: "set_topics", add: ["Cooking"], remove: [] })) });
    const demo = await live("Live recipe");
    await userEvent.type(within(demo).getByRole("textbox", { name: "Tell Claude what to change" }), "add cooking");
    await userEvent.click(within(demo).getByRole("button", { name: "Send to Claude" }));
    await within(demo).findByRole("region", { name: "Recipe log" });
    expect(storage.saved()).toBeNull();
  });

  it("shows a mirror proposal, and accepting it changes the recipe with a log line", async () => {
    renderApp({ loadCatalog });
    const proposal = await screen.findByRole("region", { name: "Recipe mirror" });
    expect(proposal).toHaveTextContent("You removed 3 Economics videos from this feed.");
    expect(await recipeLine()).toContain("Economics");

    await userEvent.click(within(proposal).getByRole("button", { name: "Remove Economics" }));

    expect(screen.queryByRole("region", { name: "Recipe mirror" })).not.toBeInTheDocument();
    expect(await recipeLine()).not.toContain("Economics");
    expect(screen.getByRole("region", { name: "Recipe log" })).toHaveTextContent("Recipe mirror: Remove Economics → removed Economics");
  });

  it("dismissing the proposal leaves the recipe alone", async () => {
    renderApp({ loadCatalog });
    const proposal = await screen.findByRole("region", { name: "Recipe mirror" });
    await userEvent.click(within(proposal).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region", { name: "Recipe mirror" })).not.toBeInTheDocument();
    expect(await recipeLine()).toContain("Economics");
  });

  it("shows reasoned cards, with the outside-your-recipe video labelled", async () => {
    renderApp({ loadCatalog });
    const cards = within(await live("Live cards"));
    const list = within(cards.getByRole("list", { name: "Up next" }));
    const items = list.getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const item of items) expect(within(item).getByText("Why this is here:", { exact: false })).toBeInTheDocument();
    expect(cards.getByText("Outside your recipe: MCP, next to AI")).toBeInTheDocument();
  });

  it("says so when the demo catalog can't load, and loads it again on retry", async () => {
    let fail = true;
    renderApp({
      loadCatalog: async () => {
        if (fail) throw new Error("Couldn't load videos.");
        return SHOWCASE_CATALOG;
      },
    });
    expect(await screen.findByText("Couldn't load videos.")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await live("Live cards")).toBeInTheDocument();
  });
});

describe("links between the app and /about", () => {
  it("goes from the app's footer to /about and back", async () => {
    goTo("/");
    renderApp({ loadCatalog });
    await upNextList();

    await userEvent.click(screen.getByRole("link", { name: "About this design" }));
    await showcase();
    expect(window.location.pathname).toBe("/about");

    await userEvent.click(screen.getAllByRole("link", { name: "Back to the app" })[0]);
    expect(await upNextList()).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("follows the browser's back button", async () => {
    goTo("/");
    renderApp({ loadCatalog });
    await userEvent.click(await screen.findByRole("link", { name: "About this design" }));
    await showcase();

    act(() => {
      goTo("/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await upNextList()).toBeInTheDocument();
  });
});
