import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AssistantResult } from "./domain/assistant";
import { actionsResult, scriptedAssistant } from "./test/assistant";
import { FEEDS_CATALOG } from "./test/feedsCatalog";
import { feedTitles, renderApp, settingsLine } from "./test/renderApp";

const BUSY = "Using simple rules for now. AI is busy.";
const TENNIS = { type: "set_topics", add: ["Tennis"], remove: [] } as const;
const SHORT = { type: "set_length_range", min: 5, max: 20 } as const;

const byRules = (result: AssistantResult): AssistantResult => ({ ...result, answeredBy: "rules", notice: BUSY });
const bar = () => screen.getByRole("textbox", { name: "Tell Claude what to change" });
const notice = () => screen.queryByText(BUSY);

function renderAnswering(...answers: AssistantResult[]) {
  const queue = [...answers];
  renderApp({ loadCatalog: async () => FEEDS_CATALOG, assistant: scriptedAssistant(() => queue.shift() ?? actionsResult()) });
}

async function openLearn() {
  await userEvent.click(within(screen.getByRole("navigation", { name: "Feeds" })).getByRole("button", { name: "Learn" }));
  await feedTitles();
}

async function ask(text: string) {
  await userEvent.type(bar(), `${text}{Enter}`);
  await waitFor(() => expect(bar()).toHaveValue(""));
}

describe("the AI busy notice", () => {
  it("shows one quiet line when the rules answer past a limit, and still applies their changes", async () => {
    renderAnswering(byRules(actionsResult(TENNIS)));
    await openLearn();
    await ask("tennis");

    expect(screen.getByRole("status", { name: "AI notice" })).toHaveTextContent(BUSY);
    expect(settingsLine()).toHaveTextContent("Showing 5 topics");
  });

  it("goes away once the model answers again, and isn't shown twice in one visit", async () => {
    renderAnswering(byRules(actionsResult(TENNIS)), byRules(actionsResult(SHORT)), actionsResult(SHORT), byRules(actionsResult(TENNIS)));
    await openLearn();
    await ask("tennis");
    await ask("short ones");
    expect(screen.getAllByText(BUSY)).toHaveLength(1);

    await ask("short ones");
    expect(notice()).not.toBeInTheDocument();

    await ask("tennis");
    expect(notice()).not.toBeInTheDocument();
  });

  it("isn't shown when the model answers", async () => {
    renderAnswering(actionsResult(TENNIS));
    await openLearn();
    await ask("tennis");
    expect(notice()).not.toBeInTheDocument();
  });
});
