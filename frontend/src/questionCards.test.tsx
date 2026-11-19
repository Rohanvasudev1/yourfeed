import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AssistantResult, FeedAction } from "./domain/assistant";
import { actionsResult, deferred, scriptedAssistant } from "./test/assistant";
import { FEEDS_CATALOG } from "./test/feedsCatalog";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp, settingsLine } from "./test/renderApp";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";

const bar = () => screen.getByRole("textbox", { name: "Tell Claude what to change" });
const card = () => screen.getByRole("region", { name: "Claude's question" });
const findCard = () => screen.findByRole("region", { name: "Claude's question" });
const noCard = () => expect(screen.queryByRole("region", { name: "Claude's question" })).not.toBeInTheDocument();
const inCard = (name: string | RegExp) => within(card()).getByRole("button", { name });
const sentence = () => settingsLine().textContent?.trim() ?? "";
const undoButton = () => screen.getByRole("button", { name: /^Undo last change/ });
const reply = () => screen.getByRole("status", { name: "Claude's reply" });

const SPORTS: FeedAction = { type: "ask_user", kind: "chips", question: "Which sports?", items: ["Tennis", "Cricket", "Live music"] };
const PICK: FeedAction = { type: "ask_user", kind: "videos", question: "Pick the ones you're feeling.", items: ["demo-103", "demo-104", "demo-105"] };

/** Answers each request with the next result, then with nothing. */
const answering = (...results: AssistantResult[]) => scriptedAssistant(() => results.shift() ?? actionsResult());

/** The demo with `feed` open, so tests can start on a feed that isn't in the tab bar. */
const openOn = (feed: string) => memoryStorage(toSaved({ ...DEMO_SEED, currentFeed: feed }));

async function start(assistant = answering(), feed = "Learn") {
  renderApp({ loadCatalog: async () => FEEDS_CATALOG, storage: openOn(feed), assistant });
  await feedTitles();
  return assistant;
}

const ask = (text: string) => userEvent.type(bar(), `${text}{Enter}`);

describe("question cards", () => {
  it("asks a broad request with chips, and adding the picks is one undo step", async () => {
    await start(answering(actionsResult(SPORTS)));
    await ask("some sport");

    expect(within(await findCard()).getByText("Which sports?")).toBeInTheDocument();
    expect(reply()).toHaveTextContent("");
    await userEvent.click(inCard("Tennis"));
    await userEvent.click(inCard("Live music"));
    expect(inCard("Tennis")).toHaveAttribute("aria-pressed", "true");
    expect(inCard("Cricket")).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(inCard("Add selected"));

    expect(sentence()).toMatch(/^Showing 6 topics/);
    noCard();
    await userEvent.click(undoButton());
    expect(sentence()).toMatch(/^Showing 4 topics/);
  });

  it("unpicks a chip when it's pressed again", async () => {
    await start(answering(actionsResult(SPORTS)));
    await ask("some sport");
    await findCard();
    await userEvent.click(inCard("Tennis"));
    await userEvent.click(inCard("Cricket"));
    await userEvent.click(inCard("Tennis"));
    await userEvent.click(inCard("Add selected"));
    expect(sentence()).toMatch(/^Showing 5 topics/);
  });

  it("offers videos when nothing matches, and adds the topics of the ones picked", async () => {
    await start(answering(actionsResult(PICK)));
    await ask("asdfgh");

    await findCard();
    await userEvent.click(inCard(/Concert of the decade/));
    await userEvent.click(inCard(/Five set final/));
    expect(inCard(/Five set final/)).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(inCard("Add selected"));

    expect(sentence()).toMatch(/^Showing 6 topics/);
    expect(await feedTitles()).toContain("Five set final");
  });

  it("shows the assistant videos from topics the feed doesn't have, one per topic", async () => {
    const assistant = await start();
    await ask("asdfgh");
    await waitFor(() => expect(assistant.calls).toHaveLength(1));

    const explore = assistant.calls[0].context.explore;
    const topics = explore.map((v) => v.topic);
    expect(new Set(topics).size).toBe(topics.length);
    expect(topics).not.toEqual(expect.arrayContaining(["AI"]));
    expect(topics.sort()).toEqual(["Live music", "News", "Tennis"]);
  });

  it("needs at least one pick before adding", async () => {
    await start(answering(actionsResult(SPORTS)));
    await ask("some sport");
    await findCard();
    await userEvent.click(inCard("Add selected"));

    expect(within(card()).getByRole("alert")).toHaveTextContent("Pick at least one first");
    expect(sentence()).toMatch(/^Showing 4 topics/);
    await userEvent.click(inCard("Tennis"));
    expect(within(card()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("closes when dismissed", async () => {
    await start(answering(actionsResult(SPORTS)));
    await ask("some sport");
    await findCard();
    await userEvent.click(inCard("Dismiss"));
    noCard();
    expect(sentence()).toMatch(/^Showing 4 topics/);
  });

  it("closes when another tab opens, and doesn't come back", async () => {
    await start(answering(actionsResult(SPORTS)));
    await ask("some sport");
    await findCard();
    const tabs = within(screen.getByRole("navigation", { name: "Feeds" }));
    await userEvent.click(tabs.getByRole("button", { name: "Sport" }));
    noCard();
    await userEvent.click(tabs.getByRole("button", { name: "Learn" }));
    noCard();
  });

  it("never shows a question that arrives after the visitor left the feed", async () => {
    const answer = deferred<AssistantResult>();
    await start(scriptedAssistant(() => answer.promise));
    await ask("some sport");
    const tabs = within(screen.getByRole("navigation", { name: "Feeds" }));
    await userEvent.click(tabs.getByRole("button", { name: "Sport" }));
    answer.resolve(actionsResult(SPORTS));
    await waitFor(() => expect(screen.queryByText("Thinking…")).not.toBeInTheDocument());
    noCard();
    await userEvent.click(tabs.getByRole("button", { name: "Learn" }));
    noCard();
  });

  it("closes when another request is sent", async () => {
    await start(answering(actionsResult(SPORTS), actionsResult({ type: "set_length_range", min: 1, max: 15 })));
    await ask("some sport");
    await findCard();
    await ask("shorter");
    await waitFor(() => expect(sentence()).toMatch(/1–15 min videos/));
    noCard();
  });

  it("is reachable from the keyboard", async () => {
    await start(answering(actionsResult(SPORTS)));
    await ask("some sport");
    await findCard();
    inCard("Tennis").focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(inCard("Add selected")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(sentence()).toMatch(/^Showing 5 topics/);
  });
});

describe("the feedback card", () => {
  const ADD_TENNIS = actionsResult({ type: "set_topics", add: ["Tennis"], remove: [] });

  it("asks after a request adds the first topics, and thumbs down takes them out as its own step", async () => {
    await start(answering(ADD_TENNIS), "Cooking");
    await ask("tennis");

    await findCard();
    expect(sentence()).toMatch(/^Showing 2 topics/);
    expect(within(card()).getByText(/Five set final/)).toBeInTheDocument();
    await userEvent.click(inCard("Not quite"));

    expect(sentence()).toMatch(/^Showing 1 topic\b/);
    noCard();
    expect(screen.getByRole("button", { name: "Undo last change (2 steps)" })).toBeInTheDocument();
    await userEvent.click(undoButton());
    expect(sentence()).toMatch(/^Showing 2 topics/);
  });

  it("keeps the topics on thumbs up", async () => {
    await start(answering(ADD_TENNIS), "Cooking");
    await ask("tennis");
    await findCard();
    await userEvent.click(inCard("Looks good"));
    noCard();
    expect(sentence()).toMatch(/^Showing 2 topics/);
  });

  it("follows picks from a question card on a near-empty feed", async () => {
    await start(answering(actionsResult(SPORTS)), "Cooking");
    await ask("some sport");
    await findCard();
    await userEvent.click(inCard("Cricket"));
    await userEvent.click(inCard("Add selected"));

    expect(await findCard()).toHaveTextContent(/Cricket/);
    expect(inCard("Not quite")).toBeInTheDocument();
  });

  it("doesn't ask on a feed that already had two topics", async () => {
    await start(answering(ADD_TENNIS));
    await ask("tennis");
    await waitFor(() => expect(sentence()).toMatch(/^Showing 5 topics/));
    noCard();
  });
});
