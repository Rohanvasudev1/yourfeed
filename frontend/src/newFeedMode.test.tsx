import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { FeedAction } from "./domain/assistant";
import { actionsResult, replyWith, scriptedAssistant } from "./test/assistant";
import { FEEDS_CATALOG } from "./test/feedsCatalog";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, openFeedTitle, renderApp, settingsLine } from "./test/renderApp";
import type { AssistantPort, StateStorage } from "./ports";

const bar = () => screen.getByRole("textbox", { name: "Tell Claude what to change" });
const modeSwitch = () => screen.getByRole("switch", { name: "New feed mode" });
const reply = () => screen.getByRole("status", { name: "Claude's reply" });
const sentence = () => settingsLine().textContent?.trim();
const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const tab = (name: string) => within(tabBar()).getByRole("button", { name });
const queryTab = (name: string) => within(tabBar()).queryByRole("button", { name });
const undoButton = () => screen.getByRole("button", { name: /^Undo last change/ });
const redoButton = () => screen.getByRole("button", { name: /^Redo the change you undid/ });

const adding = (...topics: string[]): FeedAction[] => [{ type: "create_feed" }, { type: "set_topics", add: topics, remove: [] }];

function renderWith(assistant: AssistantPort = scriptedAssistant(), storage: StateStorage = memoryStorage()) {
  return renderApp({ loadCatalog: async () => FEEDS_CATALOG, assistant, storage });
}

async function openTab(name: string) {
  await userEvent.click(tab(name));
  await feedTitles();
}

async function ask(text: string) {
  await userEvent.type(bar(), `${text}{Enter}`);
}

async function newDraft(name?: string) {
  await userEvent.click(screen.getByRole("button", { name: "New feed" }));
  if (name !== undefined) await userEvent.type(screen.getByRole("textbox", { name: "Feed name" }), `${name}{Enter}`);
}

describe("the bar's mode switch", () => {
  it("edits your own feed until switched to new mode, and says which in its tooltip and placeholder", async () => {
    renderWith();
    await openTab("Learn");

    expect(modeSwitch()).not.toBeChecked();
    expect(modeSwitch()).toHaveAccessibleDescription(/Editing Learn/);
    expect(bar()).toHaveAttribute("placeholder", "Tell Claude what to change in Learn");

    await userEvent.click(modeSwitch());
    expect(modeSwitch()).toBeChecked();
    expect(modeSwitch()).toHaveAccessibleDescription(/Making a new feed/);
    expect(bar()).toHaveAttribute("placeholder", "Tell Claude what you want to watch");
  });

  it("toggles from the keyboard, reached right after the request box", async () => {
    renderWith();
    await openTab("Learn");
    bar().focus();
    await userEvent.tab();
    expect(modeSwitch()).toHaveFocus();

    await userEvent.keyboard(" ");
    expect(modeSwitch()).toBeChecked();
  });

  it("is always in new mode on a built-in feed, disabled, with a tooltip saying why", async () => {
    renderWith();
    await feedTitles();

    expect(modeSwitch()).toBeChecked();
    expect(modeSwitch()).toHaveAttribute("aria-disabled", "true");
    expect(modeSwitch()).toHaveAccessibleDescription(/Everything is built in and can't be edited/);
    expect(bar()).toHaveAttribute("placeholder", "Tell Claude what you want to watch");

    await userEvent.click(modeSwitch());
    expect(modeSwitch()).toBeChecked();
  });

  it("keeps your choice for your own feeds across a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderWith(scriptedAssistant(), storage);
    await openTab("Learn");
    await userEvent.click(modeSwitch());
    unmount();

    renderWith(scriptedAssistant(), storage);
    await openTab("Sport");
    expect(modeSwitch()).toBeChecked();
  });

  it("starts in edit mode when the saved bar mode isn't one it knows", async () => {
    const storage = memoryStorage();
    const { unmount } = renderWith(scriptedAssistant(), storage);
    await feedTitles();
    unmount();
    const saved = storage.saved() as { version: number; state: Record<string, unknown> };
    renderWith(scriptedAssistant(), memoryStorage({ ...saved, state: { ...saved.state, barMode: "sideways" } }));
    await openTab("Learn");
    expect(modeSwitch()).not.toBeChecked();
  });
});

describe("a request in new mode", () => {
  it("makes a feed named after what it added, opens it and leaves the asking feed alone", async () => {
    const assistant = scriptedAssistant(() => actionsResult(...adding("Tennis", "Cricket")));
    renderWith(assistant);
    await feedTitles();
    const everything = sentence();
    await ask("tennis and cricket");

    await waitFor(() => expect(openFeedTitle()).toBe("Tennis & Cricket"));
    expect(assistant.calls[0].mode).toBe("new");
    expect(tab("Tennis & Cricket")).toHaveAttribute("aria-current", "page");
    expect(sentence()).toMatch(/^Showing 2 topics · 5–60 min videos · 20–90 min sessions/);
    expect(bar()).toHaveValue("");
    expect(reply()).toBeEmptyDOMElement();

    await openTab("Everything (home)");
    expect(sentence()).toBe(everything);
  });

  it("makes a new feed from one of your own feeds once switched, without changing it", async () => {
    const assistant = scriptedAssistant(() => actionsResult(...adding("Tennis")));
    renderWith(assistant);
    await openTab("Learn");
    const learn = sentence();
    await userEvent.click(modeSwitch());
    await ask("tennis");

    await waitFor(() => expect(openFeedTitle()).toBe("Tennis"));
    expect(assistant.calls[0].mode).toBe("new");
    await openTab("Learn");
    expect(sentence()).toBe(learn);
  });

  it.each([
    ["a feed you already have", adding("Cooking"), "Cooking 2"],
    ["a built-in tab", [{ type: "create_feed", name: "news" }, ...adding("News").slice(1)] as FeedAction[], "news picks"],
    ["the name the assistant gave", [{ type: "create_feed", name: "  Weekend sport  " }, ...adding("Tennis").slice(1)] as FeedAction[], "Weekend sport"],
    ["a long built-in name", [{ type: "create_feed", name: "Subscriptions" }, ...adding("Tennis").slice(1)] as FeedAction[], "Subscriptions picks"],
    ["a name past 24 characters", [{ type: "create_feed", name: "Matches from every league" }, ...adding("Tennis").slice(1)] as FeedAction[], "Matches from every leagu"],
  ])("names it uniquely when it would match %s", async (_, actions, name) => {
    renderWith(scriptedAssistant(() => actionsResult(...actions)));
    await ask("something");
    await waitFor(() => expect(openFeedTitle()).toBe(name));
  });

  it("makes nothing when the answer is only a reply", async () => {
    renderWith(scriptedAssistant(() => replyWith("Which sports?")));
    await feedTitles();
    await ask("sport");
    await waitFor(() => expect(reply()).toHaveTextContent("Which sports?"));
    expect(openFeedTitle()).toBe("Everything");
    expect(screen.queryByRole("button", { name: /^Undo last change/ })).not.toBeInTheDocument();
  });

  it("makes nothing and asks for a topic when the answer adds nothing", async () => {
    renderWith(scriptedAssistant(() => actionsResult({ type: "create_feed" })));
    await feedTitles();
    await ask("hmm");
    await waitFor(() => expect(reply()).toHaveTextContent("Name a topic to start a new feed."));
    expect(openFeedTitle()).toBe("Everything");
  });

  it("lands in All tabs when the tab bar is full, and says so", async () => {
    renderWith(scriptedAssistant(() => actionsResult(...adding("Tennis"))));
    for (const name of ["A", "B", "C", "D"]) await newDraft(name);
    await openTab("Everything (home)");
    await ask("tennis");

    await waitFor(() => expect(openFeedTitle()).toBe("Tennis"));
    expect(reply()).toHaveTextContent("The tab bar is full, so Tennis is in All tabs.");
    await userEvent.click(screen.getByRole("button", { name: "All tabs" }));
    const shelved = screen.getByRole("region", { name: "Only in All tabs" });
    expect(within(shelved).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toContain("Tennis");
  });

  it("says it landed in All tabs even when the assistant also replied", async () => {
    renderWith(scriptedAssistant(() => ({ ...actionsResult(...adding("Tennis")), reply: "Here's a tennis feed." })));
    for (const name of ["A", "B", "C", "D"]) await newDraft(name);
    await openTab("Everything (home)");
    await ask("tennis");
    await waitFor(() => expect(reply()).toHaveTextContent("Here's a tennis feed. The tab bar is full, so Tennis is in All tabs."));
  });

  it("is one undo step: undo removes the new feed and redo brings it back with its topics", async () => {
    renderWith(scriptedAssistant(() => actionsResult(...adding("Tennis", "Cricket"))));
    await feedTitles();
    await ask("tennis and cricket");
    await waitFor(() => expect(openFeedTitle()).toBe("Tennis & Cricket"));

    await userEvent.click(screen.getByRole("button", { name: "Undo last change" }));
    expect(queryTab("Tennis & Cricket")).not.toBeInTheDocument();
    expect(openFeedTitle()).toBe("Everything");

    await userEvent.click(redoButton());
    expect(openFeedTitle()).toBe("Tennis & Cricket");
    expect(sentence()).toMatch(/^Showing 2 topics/);
    await userEvent.click(within(settingsLine()).getByRole("button", { name: /topics$/ }));
    expect(screen.getByRole("dialog", { name: "Topics in this feed" })).toHaveTextContent(/Tennis.*Cricket/);
  });

  it("undoes two new feeds one at a time, and redoes both", async () => {
    renderWith(scriptedAssistant(() => actionsResult(...adding("Tennis"))));
    await feedTitles();
    await ask("tennis");
    await waitFor(() => expect(openFeedTitle()).toBe("Tennis"));
    await userEvent.click(modeSwitch());
    await ask("cricket too");
    await waitFor(() => expect(openFeedTitle()).toBe("Tennis 2"));

    await userEvent.click(undoButton());
    expect(queryTab("Tennis 2")).not.toBeInTheDocument();
    expect(openFeedTitle()).toBe("Tennis");
    await userEvent.click(undoButton());
    expect(queryTab("Tennis")).not.toBeInTheDocument();
    expect(openFeedTitle()).toBe("Everything");

    await userEvent.click(redoButton());
    await userEvent.click(redoButton());
    expect(tab("Tennis")).toBeInTheDocument();
    expect(openFeedTitle()).toBe("Tennis 2");
  });

  it("keeps the new feed across a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderWith(scriptedAssistant(() => actionsResult(...adding("Tennis"))), storage);
    await feedTitles();
    await ask("tennis");
    await waitFor(() => expect(openFeedTitle()).toBe("Tennis"));
    unmount();

    renderWith(scriptedAssistant(), storage);
    expect(openFeedTitle()).toBe("Tennis");
    expect(screen.queryByRole("button", { name: /^Undo last change/ })).not.toBeInTheDocument();
  });
});

describe("a new feed's draft", () => {
  it("stays a draft when the request adds no topic", async () => {
    renderWith(scriptedAssistant(() => actionsResult({ type: "set_length_range", min: 1, max: 15 })));
    await newDraft();
    await ask("short ones");
    await waitFor(() => expect(reply()).toHaveTextContent("Name a topic to start a new feed."));
    expect(screen.getByRole("textbox", { name: "Feed name" })).toBeInTheDocument();
  });

  it("says the bar can make it too, and a request there names the draft from what it added", async () => {
    const assistant = scriptedAssistant(() => actionsResult({ type: "set_topics", add: ["Tennis"], remove: [] }));
    renderWith(assistant);
    await newDraft();

    expect(screen.getByText(/Or tell Claude what you want in the bar above/)).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "New feed mode" })).not.toBeInTheDocument();
    await ask("tennis");

    await waitFor(() => expect(openFeedTitle()).toBe("Tennis"));
    expect(assistant.calls[0].mode).toBe("edit");
    expect(queryTab("New feed")).not.toBeInTheDocument();
    expect(sentence()).toMatch(/^Showing 1 topic/);

    await userEvent.click(undoButton());
    expect(queryTab("Tennis")).not.toBeInTheDocument();
    expect(openFeedTitle()).toBe("Everything");
  });
});
