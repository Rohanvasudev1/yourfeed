import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AssistantResult } from "./domain/assistant";
import { actionsResult, deferred, replyWith, scriptedAssistant } from "./test/assistant";
import { FEEDS_CATALOG } from "./test/feedsCatalog";
import { feedTitles, renderApp, settingsLine } from "./test/renderApp";

const LEARN_LINE = "Showing 4 topics · 10–60 min videos · 30–90 min sessions · 4 filters on";

const bar = () => screen.getByRole("textbox", { name: "Tell Claude what to change" });
const sendButton = () => screen.getByRole("button", { name: /^Send to Claude|Thinking…/ });
const reply = () => screen.getByRole("status", { name: "Claude's reply" });
const sentence = () => settingsLine().textContent?.trim();
const undoButton = () => screen.getByRole("button", { name: /^Undo last change/ });
const redoButton = () => screen.getByRole("button", { name: /^Redo the change you undid/ });

function renderWith(assistant = scriptedAssistant()) {
  renderApp({ loadCatalog: async () => FEEDS_CATALOG, assistant });
  return assistant;
}

async function openTab(name: string) {
  await userEvent.click(within(screen.getByRole("navigation", { name: "Feeds" })).getByRole("button", { name }));
  await feedTitles();
}

async function ask(text: string) {
  await userEvent.type(bar(), `${text}{Enter}`);
}

describe("the Claude bar on one of your feeds", () => {
  it("applies every action of a request at once, and one undo takes them all back", async () => {
    renderWith(
      scriptedAssistant(() =>
        actionsResult(
          { type: "set_topics", add: ["Tennis"], remove: ["Careers"] },
          { type: "mute_topic", topic: "Economics" },
          { type: "set_length_range", min: 5, max: 20 },
          { type: "set_session_range", min: 50, max: 60 },
        ),
      ),
    );
    await openTab("Learn");
    await ask("tennis, short ones, no economics, I have an hour");

    await waitFor(() => expect(sentence()).toBe("Showing 3 topics, 1 hidden · 5–20 min videos · 50–60 min sessions · 4 filters on"));
    expect((await feedTitles()).sort()).toEqual(["Five set final", "Fresh agent build"]);
    expect(bar()).toHaveValue("");

    await userEvent.click(undoButton());
    expect(sentence()).toBe(LEARN_LINE);
    expect(await feedTitles()).not.toContain("Five set final");

    await userEvent.click(redoButton());
    expect(sentence()).toBe("Showing 3 topics, 1 hidden · 5–20 min videos · 50–60 min sessions · 4 filters on");
  });

  it("makes each request its own undo step, even two that only move the length range", async () => {
    const lengths = [actionsResult({ type: "set_length_range", min: 1, max: 15 }), actionsResult({ type: "set_length_range", min: 20, max: 120 })];
    renderWith(scriptedAssistant(() => lengths.shift() ?? replyWith("Done")));
    await openTab("Learn");
    await ask("shorter");
    await waitFor(() => expect(sentence()).toMatch(/1–15 min videos/));
    await ask("longer");
    await waitFor(() => expect(sentence()).toMatch(/20–120 min videos/));

    await userEvent.click(screen.getByRole("button", { name: "Undo last change (2 steps)" }));
    expect(sentence()).toMatch(/1–15 min videos/);
  });

  it("sends with the send button too", async () => {
    renderWith(scriptedAssistant(() => actionsResult({ type: "set_topics", add: ["Tennis"], remove: [] })));
    await openTab("Learn");
    await userEvent.type(bar(), "add tennis");
    await userEvent.click(sendButton());
    await waitFor(() => expect(sentence()).toMatch(/^Showing 5 topics/));
  });

  it("pins a video first in Up next", async () => {
    renderWith(scriptedAssistant(() => actionsResult({ type: "pin_video", id: "demo-102" })));
    await openTab("Learn");
    await ask("put the economics one first");
    await waitFor(async () => expect((await feedTitles())[0]).toBe("Learning economics"));
  });

  it("tells the assistant the request, the mode and the current feed with its Up next", async () => {
    const assistant = renderWith();
    await openTab("Learn");
    await ask("  add cooking  ");

    await waitFor(() => expect(assistant.calls).toHaveLength(1));
    const [{ text, mode, context }] = assistant.calls;
    expect(text).toBe("add cooking");
    expect(mode).toBe("edit");
    expect(context).toMatchObject({
      kind: "topics",
      name: "Learn",
      topics: ["AI", "Programming", "Economics", "Careers"],
      muted: [],
      length: [10, 60],
      session: [30, 90],
      pinned: [],
    });
    expect(context.upNext.map((v) => v.title)).toEqual(await feedTitles());
    expect(context.upNext).toContainEqual({ id: "demo-100", title: "Fresh agent build", topic: "AI", channel: "Agent Workshop" });
  });

  it("shows the assistant's reply and changes nothing", async () => {
    renderWith(scriptedAssistant(() => replyWith('"Fresh agent build" matches AI in this feed.')));
    await openTab("Learn");
    await ask("why is this first?");

    await waitFor(() => expect(reply()).toHaveTextContent('"Fresh agent build" matches AI in this feed.'));
    expect(sentence()).toBe(LEARN_LINE);
    expect(screen.queryByRole("button", { name: /^Undo last change/ })).not.toBeInTheDocument();
  });

  it("says Already in this feed when the request changes nothing", async () => {
    renderWith(scriptedAssistant(() => actionsResult({ type: "set_topics", add: ["AI"], remove: [] })));
    await openTab("Learn");
    await ask("add AI");

    await waitFor(() => expect(reply()).toHaveTextContent("Already in this feed."));
    expect(screen.queryByRole("button", { name: /^Undo last change/ })).not.toBeInTheDocument();
  });

  it("asks for something when the box is empty, without calling the assistant", async () => {
    const assistant = renderWith();
    await openTab("Learn");
    await ask("   ");
    expect(screen.getByText("Type something first")).toBeInTheDocument();
    expect(assistant.calls).toHaveLength(0);

    await ask("add tennis");
    await waitFor(() => expect(screen.queryByText("Type something first")).not.toBeInTheDocument());
  });

  it("refuses requests over 300 characters", async () => {
    const assistant = renderWith();
    await openTab("Learn");
    await userEvent.click(bar());
    await userEvent.paste("x".repeat(301));
    await userEvent.keyboard("{Enter}");

    expect(screen.getByText("Keep requests under 300 characters")).toBeInTheDocument();
    expect(assistant.calls).toHaveLength(0);
  });

  it("shows Thinking… and won't send again until the answer arrives", async () => {
    const answer = deferred<AssistantResult>();
    const assistant = renderWith(scriptedAssistant(() => answer.promise));
    await openTab("Learn");
    await ask("add tennis");

    expect(sendButton()).toBeDisabled();
    expect(sendButton()).toHaveAccessibleName("Thinking…");
    expect(screen.getByText("Thinking…")).toBeVisible();
    await userEvent.type(bar(), "{Enter}");
    expect(assistant.calls).toHaveLength(1);

    answer.resolve(actionsResult({ type: "set_topics", add: ["Tennis"], remove: [] }));
    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(sendButton()).toHaveAccessibleName("Send to Claude");
    expect(sentence()).toMatch(/^Showing 5 topics/);
  });

  it("keeps the request and says so when the assistant can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderWith(scriptedAssistant(() => Promise.reject(new Error("offline"))));
    await openTab("Learn");
    await ask("add tennis");

    expect(await screen.findByText("Couldn't reach Claude. Try again.")).toBeInTheDocument();
    expect(bar()).toHaveValue("add tennis");
    expect(sendButton()).toBeEnabled();
  });

  it("applies the answer to the feed that asked, even after switching tabs", async () => {
    const answer = deferred<AssistantResult>();
    renderWith(scriptedAssistant(() => answer.promise));
    await openTab("Learn");
    await ask("add tennis");
    await openTab("Sport");

    answer.resolve(actionsResult({ type: "set_topics", add: ["Live music"], remove: [] }));
    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(sentence()).toMatch(/^Showing 4 topics/);
    await openTab("Learn");
    expect(sentence()).toMatch(/^Showing 5 topics/);
  });
});

describe("the Claude bar on a built-in feed", () => {
  it("asks in new mode and never edits the built-in feed", async () => {
    const assistant = renderWith(
      scriptedAssistant(() => ({
        actions: [{ type: "set_topics", add: ["Tennis"], remove: [] }],
        reply: "This tab builds itself, so I can't change it. Try one of your own feeds.",
        answeredBy: "rules",
      })),
    );
    await feedTitles();
    const before = sentence();
    await ask("add tennis");

    await waitFor(() => expect(reply()).toHaveTextContent("This tab builds itself"));
    expect(assistant.calls[0].mode).toBe("new");
    expect(assistant.calls[0].context.kind).toBe("home");
    expect(sentence()).toBe(before);
  });
});

describe("the Claude bar's controls", () => {
  it("are reachable from the keyboard and named", async () => {
    renderWith();
    await openTab("Learn");
    bar().focus();
    await userEvent.tab();
    expect(sendButton()).toHaveFocus();
    expect(bar()).toHaveAttribute("placeholder", "Tell Claude what you want to watch");
  });
});
