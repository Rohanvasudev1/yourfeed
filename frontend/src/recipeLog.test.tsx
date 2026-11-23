import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AssistantResult, FeedAction } from "./domain/assistant";
import { actionsResult, replyWith, scriptedAssistant } from "./test/assistant";
import { FEEDS_CATALOG } from "./test/feedsCatalog";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp, settingsLine } from "./test/renderApp";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";

const bar = () => screen.getByRole("textbox", { name: "Tell Claude what to change" });
const sentence = () => settingsLine().textContent?.trim() ?? "";
const undoButton = () => screen.getByRole("button", { name: /^Undo last change/ });
const redoButton = () => screen.getByRole("button", { name: /^Redo the change you undid/ });
const log = () => screen.getByRole("region", { name: "Recipe log" });
const noLog = () => expect(screen.queryByRole("region", { name: "Recipe log" })).not.toBeInTheDocument();
const lines = () => within(log()).getAllByRole("listitem").map((li) => li.textContent);
const card = () => screen.findByRole("region", { name: "Claude's question" });

const SHORTER = actionsResult({ type: "set_length_range", min: 1, max: 15 });
const COOKING = actionsResult({ type: "set_topics", add: ["Cooking"], remove: [] });

/** Answers each request with the next result, then with nothing. */
const answering = (...results: AssistantResult[]) => scriptedAssistant(() => results.shift() ?? actionsResult());

const openOn = (feed: string) => memoryStorage(toSaved({ ...DEMO_SEED, currentFeed: feed }));

async function start(assistant = answering(), storage = openOn("Learn")) {
  renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage, assistant });
  await feedTitles();
  return assistant;
}

async function ask(text: string) {
  await userEvent.type(bar(), `${text}{Enter}`);
  await waitFor(() => expect(bar()).toHaveValue(""));
}

async function openTab(name: string) {
  await userEvent.click(within(screen.getByRole("navigation", { name: "Feeds" })).getByRole("button", { name }));
  await feedTitles();
}

describe("the recipe log", () => {
  it("adds a line per request, and sends earlier lines as follow-ups", async () => {
    const assistant = await start(answering(SHORTER, replyWith("Shorter still.")));
    noLog();
    await ask("shorter videos");
    expect(lines()).toEqual(["shorter videos → videos 1–15 min"]);

    await ask("no, shorter");
    expect(assistant.calls[0].followUps).toEqual([]);
    expect(assistant.calls[1].followUps).toEqual([{ request: "shorter videos", summary: "videos 1–15 min" }]);
    expect(lines()).toEqual(["shorter videos → videos 1–15 min", "no, shorter → no change · Shorter still."]);
  });

  it("sends only the last 3 live lines, oldest first", async () => {
    const assistant = await start();
    for (const text of ["one", "two", "three", "four"]) await ask(text);
    await ask("five");
    expect(assistant.calls[4].followUps.map((f) => f.request)).toEqual(["two", "three", "four"]);
  });

  it("greys out a line on undo and stops sending it; redo restores it", async () => {
    const assistant = await start(answering(SHORTER));
    await ask("shorter videos");
    await userEvent.click(undoButton());

    const [line] = within(log()).getAllByRole("listitem");
    expect(line).toHaveTextContent("Undone: shorter videos → videos 1–15 min");
    await ask("hello");
    expect(assistant.calls[1].followUps).toEqual([]);

    await userEvent.click(redoButton());
    expect(within(log()).getAllByRole("listitem")[0]).not.toHaveTextContent("Undone");
    await ask("again");
    expect(assistant.calls[2].followUps.map((f) => f.request)).toEqual(["shorter videos", "hello"]);
  });

  it("logs question card answers", async () => {
    const sports: FeedAction = { type: "ask_user", kind: "chips", question: "Which sports?", items: ["Tennis", "Cricket"] };
    await start(answering(actionsResult(sports)));
    await ask("some sport");
    const question = await card();
    await userEvent.click(within(question).getByRole("button", { name: "Tennis" }));
    await userEvent.click(within(question).getByRole("button", { name: "Add selected" }));

    expect(lines()).toEqual(["some sport → asked Which sports?", "Which sports? Tennis → added Tennis"]);
    await userEvent.click(undoButton());
    expect(within(log()).getAllByRole("listitem")[1]).toHaveTextContent("Undone");
  });

  it("logs both answers to a feedback card", async () => {
    const tennis = actionsResult({ type: "set_topics", add: ["Tennis"], remove: [] });
    await start(answering(tennis, tennis), openOn("Cooking"));
    await ask("add tennis");
    await userEvent.click(within(await card()).getByRole("button", { name: "Not quite" }));
    expect(lines()).toEqual(["add tennis → added Tennis", "Added Tennis. Look right? Not quite → removed Tennis"]);

    await ask("add tennis");
    await userEvent.click(within(await card()).getByRole("button", { name: "Looks good" }));
    expect(lines().at(-1)).toBe("Added Tennis. Look right? Looks good → no change");
  });

  it("clears the log without changing the feed or its undo steps", async () => {
    await start(answering(COOKING));
    await ask("add cooking");
    const before = sentence();
    await userEvent.click(within(log()).getByRole("button", { name: "Clear log" }));

    noLog();
    expect(sentence()).toBe(before);
    expect(undoButton()).toHaveAccessibleName("Undo last change");
    await userEvent.click(undoButton());
    expect(sentence()).not.toBe(before);
  });

  it("keeps a log per feed and across a reload", async () => {
    const storage = openOn("Learn");
    const assistant = await start(answering(SHORTER, COOKING), storage);
    await ask("shorter videos");
    await openTab("Sport");
    noLog();
    await ask("add cooking");
    expect(assistant.calls[1].followUps).toEqual([]);

    cleanup();
    await start(answering(), storage);
    expect(lines()).toEqual(["add cooking → added Cooking"]);
    await openTab("Learn");
    expect(lines()).toEqual(["shorter videos → videos 1–15 min"]);
  });

  it("starts a new feed's log with the request that made it", async () => {
    await start(answering(actionsResult({ type: "create_feed", name: "Tennis" }, { type: "set_topics", add: ["Tennis"], remove: [] })), openOn("Everything"));
    await ask("a feed for tennis");
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("Tennis"));
    expect(lines()).toEqual(["a feed for tennis → new feed with Tennis"]);
  });

  it("sends 15 Up next videos at most", async () => {
    const assistant = await start(undefined, openOn("Everything"));
    await ask("why is this first?");
    expect(assistant.calls[0].context.upNext.length).toBeLessThanOrEqual(15);
  });

  it("is reachable from the keyboard", async () => {
    await start(answering(COOKING));
    await ask("add cooking");
    const clear = within(log()).getByRole("button", { name: "Clear log" });
    clear.focus();
    await userEvent.keyboard("{Enter}");
    noLog();
  });

  it("keeps an old save that has no logs", async () => {
    const saved = toSaved({ ...DEMO_SEED, currentFeed: "Learn" });
    const feeds = saved.state.feeds.map((f) => Object.fromEntries(Object.entries(f).filter(([key]) => key !== "log")));
    const assistant = await start(answering(), memoryStorage({ ...saved, state: { ...saved.state, feeds } }));
    noLog();
    await ask("hello");
    expect(assistant.calls[0].context.name).toBe("Learn");
  });
});
