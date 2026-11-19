import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { actionsResult, scriptedAssistant } from "./test/assistant";
import { FEEDS_CATALOG } from "./test/feedsCatalog";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp, settingsLine } from "./test/renderApp";

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const connectPanel = () => screen.getByRole("region", { name: "Connect Claude" });
const workPanel = () => screen.getByRole("region", { name: "From your recent Claude work" });
const connectButton = () => screen.getByRole("button", { name: "Connect Claude" });
const disconnectButton = () => screen.getByRole("button", { name: "Disconnect Claude" });
const bar = () => screen.getByRole("textbox", { name: "Tell Claude what to change" });
const reply = () => screen.getByRole("status", { name: "Claude's reply" });
const sentence = () => settingsLine().textContent?.trim();
const undoButton = () => screen.getByRole("button", { name: /^Undo last change/ });

const CONNECTED_LINE = "Showing 4 topics · 5–60 min videos · 20–90 min sessions · 4 filters on";
const EMPTY_LINE = "Showing 0 topics · 5–60 min videos · 20–90 min sessions · 4 filters on";

function renderFromClaude({ assistant = scriptedAssistant(), storage = memoryStorage() } = {}) {
  renderApp({ loadCatalog: async () => FEEDS_CATALOG, assistant, storage });
  return { assistant, storage };
}

async function openFromClaude() {
  await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: /^From Claude/ }));
  await screen.findByRole("heading", { level: 2, name: "From Claude" });
}

describe("From Claude", () => {
  it("is in the Explore menu with its icon and description", async () => {
    renderFromClaude();
    await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
    const item = within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: /^From Claude/ });
    expect(item).toHaveTextContent("From ClaudeFrom your Claude work");
    expect(item.querySelector("svg")).not.toBeNull();
  });

  it("starts with a Connect Claude step that says only a short summary is shared, labelled as a demo, and shows no videos", async () => {
    renderFromClaude();
    await openFromClaude();

    expect(connectPanel()).toHaveTextContent("Claude shares a short summary of what you've been working on recently. Nothing else from your chats is shared");
    expect(connectPanel()).toHaveTextContent("Demo only");
    expect(sentence()).toBe(EMPTY_LINE);
    expect(await feedTitles()).toEqual([]);
    expect(screen.getByRole("note", { name: "Session plan" })).not.toHaveTextContent("short of your minimum");
  });

  it("fills the feed with the summary's topics when you connect, and lists the work with its topics", async () => {
    renderFromClaude();
    await openFromClaude();
    await userEvent.click(connectButton());

    expect(sentence()).toBe(CONNECTED_LINE);
    expect(await feedTitles()).toEqual(["Fresh agent build"]);
    expect(screen.queryByRole("region", { name: "Connect Claude" })).not.toBeInTheDocument();
    const work = within(workPanel()).getAllByRole("listitem").map((li) => li.textContent);
    expect(work).toEqual([
      "Designing a custom YouTube feed appProduct design",
      "Building MCP tools and agentsMCP, AI",
      "Debugging a TypeScript projectProgramming",
    ]);
    expect(workPanel()).toHaveTextContent("Demo only");
    expect(disconnectButton()).toHaveFocus();
  });

  it("clears its topics when you disconnect, back to the Connect Claude step", async () => {
    renderFromClaude();
    await openFromClaude();
    await userEvent.click(connectButton());
    await userEvent.click(disconnectButton());

    expect(sentence()).toBe(EMPTY_LINE);
    expect(await feedTitles()).toEqual([]);
    expect(connectButton()).toHaveFocus();
  });

  it("treats connecting as one undo step that takes the connection back too", async () => {
    renderFromClaude();
    await openFromClaude();
    await userEvent.click(connectButton());
    await userEvent.click(undoButton());

    expect(sentence()).toBe(EMPTY_LINE);
    expect(connectPanel()).toBeInTheDocument();
  });

  it("can be connected and disconnected from the keyboard", async () => {
    renderFromClaude();
    await openFromClaude();
    connectButton().focus();
    await userEvent.keyboard("{Enter}");
    expect(sentence()).toBe(CONNECTED_LINE);
    await userEvent.keyboard("{Enter}");
    expect(sentence()).toBe(EMPTY_LINE);
  });

  it("answers requests before connecting with the next step, without asking the assistant", async () => {
    const { assistant } = renderFromClaude();
    await openFromClaude();
    await userEvent.type(bar(), "add tennis{Enter}");

    expect(reply()).toHaveTextContent("Connect Claude first, then tell me what to add.");
    expect(assistant.calls).toEqual([]);
    expect(sentence()).toBe(EMPTY_LINE);
  });

  it("sends a suggestion chip as a request that changes this feed once connected", async () => {
    const assistant = scriptedAssistant((text) =>
      text === "Something to learn tonight" ? actionsResult({ type: "set_topics", add: ["Economics"], remove: [] }) : actionsResult(),
    );
    renderFromClaude({ assistant });
    await openFromClaude();
    await userEvent.click(connectButton());
    const chips = within(workPanel()).getByRole("group", { name: "What would you like to add?" });
    expect(within(chips).getAllByRole("button").map((b) => b.textContent)).toEqual(["More MCP tutorials", "Something to learn tonight", "Surprise me"]);

    await userEvent.click(within(chips).getByRole("button", { name: "Something to learn tonight" }));

    await waitFor(() => expect(sentence()).toBe("Showing 5 topics · 5–60 min videos · 20–90 min sessions · 4 filters on"));
    expect(assistant.calls.map((c) => [c.text, c.mode, c.context.name])).toEqual([["Something to learn tonight", "edit", "From Claude"]]);
    expect((await feedTitles()).sort()).toEqual(["Fresh agent build", "Learning economics", "Older ledger story"]);
  });

  it("lets you switch the bar between editing it and making a new feed only once connected", async () => {
    renderFromClaude();
    await openFromClaude();
    const modeSwitch = () => screen.getByRole("switch", { name: "New feed mode" });
    expect(modeSwitch()).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(connectButton());
    expect(modeSwitch()).not.toHaveAttribute("aria-disabled");
    expect(modeSwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("keeps what you typed in the Claude bar when you tap a suggestion", async () => {
    renderFromClaude();
    await openFromClaude();
    await userEvent.click(connectButton());
    await userEvent.type(bar(), "half typed");
    await userEvent.click(screen.getByRole("button", { name: "Surprise me" }));

    await waitFor(() => expect(reply()).toHaveTextContent("OK."));
    expect(bar()).toHaveValue("half typed");
  });

  it("stays connected after a reload", async () => {
    const storage = memoryStorage();
    const first = renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage });
    await openFromClaude();
    await userEvent.click(connectButton());
    first.unmount();

    renderFromClaude({ storage });
    await openFromClaude();
    expect(workPanel()).toBeInTheDocument();
    expect(sentence()).toBe(CONNECTED_LINE);
  });

  it("starts from the demo when a saved connection isn't a yes or no", async () => {
    const storage = memoryStorage();
    const first = renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage });
    await openFromClaude();
    first.unmount();
    const saved = storage.saved() as { version: number; state: { feeds: Record<string, unknown>[]; currentFeed: string } };
    const feeds = saved.state.feeds.map((f) => (f.kind === "claude" ? { ...f, connected: "yes" } : f));

    renderFromClaude({ storage: memoryStorage({ ...saved, state: { ...saved.state, feeds } }) });
    expect(await screen.findByRole("heading", { level: 2, name: "Everything" })).toBeInTheDocument();
  });
});
