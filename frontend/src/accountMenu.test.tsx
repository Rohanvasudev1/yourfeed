import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AssistantInfo } from "./domain/assistantInfo";
import { actionsResult, answerWith, GROQ_INFO, scriptedAssistant } from "./test/assistant";
import { EVERYTHING_ORDER, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, openFeedTitle, renderApp } from "./test/renderApp";

const RULES: AssistantInfo = { answeredBy: "rules", provider: null, model: null };
const GROQ_NOTICE = "Requests and note questions go to Groq. Don't include anything private.";
const RULES_NOTICE = "Requests and note questions go to Yourfeed's server, where simple rules answer them. Don't include anything private.";

const avatar = () => screen.getByRole("button", { name: "Your account" });
const menu = () => screen.getByRole("dialog", { name: "Your account" });
const bar = () => screen.getByRole("textbox", { name: "Tell Claude what to change" });
const barNotice = () => screen.queryByRole("note", { name: "Provider notice" });
/** A menu jump: its button's name is the label followed by its count, if any. */
const item = (label: string) => within(menu()).getByRole("button", { name: new RegExp(`^${label}`) });

function renderWith({ info = GROQ_INFO, storage = memoryStorage() }: { info?: AssistantInfo | Error; storage?: ReturnType<typeof memoryStorage> } = {}) {
  const assistant = scriptedAssistant(() => actionsResult({ type: "set_length_range", min: 5, max: 20 }), {
    answerQuestion: () => answerWith("An answer."),
    info: () => (info instanceof Error ? Promise.reject(info) : info) });
  const view = renderApp({ storage, assistant });
  return { ...view, assistant, storage };
}

async function openMenu() {
  await feedTitles();
  await userEvent.click(avatar());
  return menu();
}

describe("the account menu", () => {
  // Saved and Watch history count the videos their sections list: only one seeded id of each is in the test catalog.
  it("says who you are, with a count beside each jump", async () => {
    renderWith();
    const opened = await openMenu();

    expect(opened).toHaveTextContent("You");
    expect(opened).toHaveTextContent("@you · demo account");
    expect(item("All your feeds")).toHaveTextContent("All your feeds11");
    expect(item("Saved")).toHaveTextContent("Saved1");
    expect(item("Watch history")).toHaveTextContent("Watch history1");
    expect(item("Feed notes")).toHaveTextContent(/^Feed notes$/);
    expect(item("Shared with you")).toHaveTextContent("Shared with you3");
    expect(item("Blends")).toHaveTextContent("Blends2");
    expect(item("Connect Claude")).toBeInTheDocument();
    expect(await within(opened).findByText("Signing in isn't set up here.")).toBeInTheDocument();
  });

  it("counts what's in the app right now", async () => {
    renderWith();
    await userEvent.click(within(await cardFor("Intro to transformers")).getByRole("button", { name: "Mark Intro to transformers as watched" }));
    await openMenu();
    expect(item("Watch history")).toHaveTextContent("Watch history2");
  });

  it("opens All your feeds", async () => {
    renderWith();
    await openMenu();
    await userEvent.click(item("All your feeds"));
    expect(await screen.findByRole("heading", { level: 2, name: "All tabs" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Your account" })).not.toBeInTheDocument();
  });

  it.each([
    ["Saved", "Saved"],
    ["Watch history", "Watch history"],
    ["Feed notes", "Feed notes"],
  ])("opens the %s section and moves focus to it", async (label, region) => {
    renderWith();
    await openMenu();
    await userEvent.click(item(label));
    const toggle = within(screen.getByRole("region", { name: region })).getByRole("button", { name: new RegExp(`^${region}`) });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(toggle).toHaveFocus());
  });

  it("reaches a section from the All tabs page", async () => {
    renderWith();
    await openMenu();
    await userEvent.click(item("All your feeds"));
    await userEvent.click(avatar());
    await userEvent.click(item("Saved"));
    const toggle = within(screen.getByRole("region", { name: "Saved" })).getByRole("button", { name: /^Saved/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it.each([
    ["Shared with you", "Shared with you"],
    ["Blends", "Blend"],
    ["Connect Claude", "From Claude"],
  ])("%s opens its feed", async (label, title) => {
    renderWith();
    await openMenu();
    await userEvent.click(item(label));
    await waitFor(() => expect(openFeedTitle()).toBe(title));
  });

  it("says Claude is connected once it is", async () => {
    renderWith();
    await openMenu();
    await userEvent.click(item("Connect Claude"));
    await userEvent.click(await screen.findByRole("button", { name: "Connect Claude" }));
    await userEvent.click(avatar());
    expect(item("Claude connected")).toBeInTheDocument();
  });

  it("names the model and provider answering", async () => {
    renderWith({ info: GROQ_INFO });
    await openMenu();
    expect(await within(menu()).findByText("Answers by gpt-oss-20b via Groq")).toBeInTheDocument();
    expect(menu()).toHaveTextContent(GROQ_NOTICE);
  });

  it("says when simple rules answer", async () => {
    renderWith({ info: RULES });
    await openMenu();
    expect(await within(menu()).findByText("Answers by simple rules")).toBeInTheDocument();
    expect(menu()).toHaveTextContent(RULES_NOTICE);
  });

  it("is reachable by keyboard, and Escape hands focus back", async () => {
    renderWith();
    await feedTitles();
    avatar().focus();
    await userEvent.keyboard("{Enter}");
    expect(menu()).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Your account" })).not.toBeInTheDocument();
    expect(avatar()).toHaveFocus();
  });
});

describe("the provider notice", () => {
  it("shows under the Claude bar before the first request, then stays only in the menu", async () => {
    renderWith();
    await feedTitles();
    expect(await screen.findByRole("note", { name: "Provider notice" })).toHaveTextContent(GROQ_NOTICE);

    await userEvent.type(bar(), "tennis{Enter}");
    await waitFor(() => expect(bar()).toHaveValue(""));
    expect(barNotice()).not.toBeInTheDocument();

    await userEvent.click(avatar());
    expect(menu()).toHaveTextContent(GROQ_NOTICE);
  });

  it("doesn't come back when the first request is undone", async () => {
    renderWith();
    await feedTitles();
    await userEvent.click(within(screen.getByRole("navigation", { name: "Feeds" })).getByRole("button", { name: "Learn" }));
    await userEvent.type(bar(), "short ones{Enter}");
    await waitFor(() => expect(bar()).toHaveValue(""));
    await userEvent.click(screen.getByRole("button", { name: /^Undo last change/ }));
    expect(barNotice()).not.toBeInTheDocument();
  });

  it("goes once a question in notes is asked", async () => {
    vi.stubGlobal("open", vi.fn(() => ({}) as Window));
    const { assistant } = renderWith();
    const [first] = EVERYTHING_ORDER;
    await userEvent.click(within(await cardFor(first)).getByRole("button", { name: first }));
    const notes = within(screen.getByRole("region", { name: "Watching now" })).getByRole("textbox", { name: `Notes on ${first}` });
    await userEvent.type(notes, "What is it?{Enter}");
    await waitFor(() => expect(assistant.questions).toHaveLength(1));
    expect(barNotice()).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("isn't shown again after a reload", async () => {
    const storage = memoryStorage();
    const first = renderWith({ storage });
    await feedTitles();
    await userEvent.type(bar(), "tennis{Enter}");
    await waitFor(() => expect(first.assistant.calls).toHaveLength(1));
    first.unmount();

    renderWith({ storage });
    await feedTitles();
    expect(barNotice()).not.toBeInTheDocument();
  });

  it("shows when the saved flag isn't a yes or no", async () => {
    const storage = memoryStorage();
    const first = renderWith({ storage });
    await feedTitles();
    first.unmount();
    const saved = storage.saved() as { version: number; state: Record<string, unknown> };
    renderWith({ storage: memoryStorage({ ...saved, state: { ...saved.state, providerNoticeSeen: "maybe" } }) });
    await feedTitles();
    expect(await screen.findByRole("note", { name: "Provider notice" })).toHaveTextContent(GROQ_NOTICE);
    expect(openFeedTitle()).toBe("Everything");
  });

  it("still warns, without naming anyone, when the server can't say who answers", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderWith({ info: new Error("down") });
    await feedTitles();
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(barNotice()).toHaveTextContent("Requests and note questions go to Yourfeed's server. Don't include anything private.");
    await userEvent.click(avatar());
    expect(within(menu()).queryByText(/^Answers by/)).not.toBeInTheDocument();
    error.mockRestore();
  });
});
