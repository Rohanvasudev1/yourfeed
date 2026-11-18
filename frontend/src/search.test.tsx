import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRecognition, recognition } from "./test/fakeRecognition";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp, toggleFilters } from "./test/renderApp";

beforeEach(() => {
  vi.stubGlobal(
    "open",
    vi.fn(() => ({}) as Window),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const box = () => screen.getByRole("combobox", { name: "Search" });
const suggestions = () => screen.queryByRole("listbox", { name: "Search suggestions" });
const optionNames = () => within(screen.getByRole("listbox", { name: "Search suggestions" })).getAllByRole("option").map((o) => o.textContent);
const resultsPage = () => screen.getByRole("region", { name: "Search results" });
const resultTitles = () =>
  within(resultsPage())
    .queryAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);

async function searchFor(text: string) {
  await userEvent.click(box());
  await userEvent.clear(box());
  await userEvent.type(box(), `${text}{Enter}`);
}

describe("search suggestions", () => {
  it("shows recent searches when the box is focused, and ranked suggestions as you type", async () => {
    renderApp();
    await userEvent.click(box());

    expect(box()).toHaveAttribute("aria-expanded", "true");
    expect(optionNames()).toEqual(["mcp server", "premier league highlights"]);

    await userEvent.type(box(), "agent");
    // The channel names three videos, so it outranks the titles; "ai agent workshop" matches on a later word.
    expect(optionNames()).toEqual(["agent workshop", "agents with memory", "already watched agent build", "ai agent workshop"]);
  });

  it("bolds the part of a suggestion you haven't typed", async () => {
    renderApp();
    await userEvent.type(box(), "memory");

    const option = screen.getByRole("option", { name: "agents with memory" });
    expect(option.querySelector("b")).toHaveTextContent("agents with");
  });

  it("puts matching recent searches first and lets you remove one", async () => {
    renderApp();
    await userEvent.type(box(), "m");
    expect(optionNames()[0]).toBe("mcp server");

    await userEvent.click(screen.getByRole("button", { name: "Remove mcp server from recent searches" }));

    expect(optionNames()).not.toContain("mcp server");
    expect(box()).toHaveFocus();
  });

  it("fills in a suggestion without searching", async () => {
    renderApp();
    await userEvent.type(box(), "agents");
    await userEvent.click(screen.getByRole("button", { name: "Fill in agents with memory" }));

    expect(box()).toHaveValue("agents with memory ");
    expect(box()).toHaveFocus();
    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
  });

  it("searches when you click a suggestion", async () => {
    renderApp();
    await userEvent.type(box(), "agents");
    await userEvent.click(screen.getByRole("option", { name: "agents with memory" }));

    expect(screen.getByRole("heading", { level: 2, name: '1 result for "agents with memory"' })).toBeInTheDocument();
  });
});

describe("searching from the keyboard", () => {
  it("moves through suggestions with the arrows, filling the box, and searches with Enter", async () => {
    renderApp();
    await userEvent.type(box(), "agent");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const active = screen.getByRole("option", { name: "agents with memory" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(box()).toHaveAttribute("aria-activedescendant", active.id);
    expect(box()).toHaveValue("agents with memory");

    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(box()).toHaveValue("agent");
    expect(box()).not.toHaveAttribute("aria-activedescendant");

    await userEvent.keyboard("{ArrowUp}");
    expect(box()).toHaveValue("ai agent workshop");

    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 2, name: '2 results for "ai agent workshop"' })).toBeInTheDocument();
    expect(suggestions()).not.toBeInTheDocument();
  });

  it("closes the suggestions with Escape, putting back what you typed", async () => {
    renderApp();
    await userEvent.type(box(), "agent{ArrowDown}");
    expect(box()).toHaveValue("agent workshop");

    await userEvent.keyboard("{Escape}");

    expect(suggestions()).not.toBeInTheDocument();
    expect(box()).toHaveAttribute("aria-expanded", "false");
    expect(box()).toHaveValue("agent");

    await userEvent.keyboard("{ArrowDown}");
    expect(suggestions()).toBeInTheDocument();
  });

  it("removes the highlighted recent search with Shift+Delete", async () => {
    renderApp();
    await userEvent.click(box());
    await userEvent.keyboard("{ArrowDown}{Shift>}{Delete}{/Shift}");

    expect(optionNames()).toEqual(["premier league highlights"]);
  });

  it("does nothing for an empty search", async () => {
    renderApp();
    await userEvent.type(box(), "   {Enter}");

    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
  });

  it("searches with the search button", async () => {
    renderApp();
    await userEvent.type(box(), "transformers");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(resultTitles()).toEqual(["Intro to transformers"]);
  });
});

describe("the search page", () => {
  it("says how many results there are, where pins go, and goes back to the feed", async () => {
    renderApp();
    await feedTitles();
    await searchFor("Agent Workshop");

    expect(screen.getByRole("heading", { level: 2, name: '2 results for "Agent Workshop"' })).toBeInTheDocument();
    expect(within(resultsPage()).getByText("Adding to: Everything")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to feed" }));
    expect(screen.getByRole("heading", { level: 2, name: "Everything" })).toBeInTheDocument();
  });

  it("matches titles, honest titles, channels and topics, leaving out clickbait while Hide clickbait is on", async () => {
    renderApp();
    await feedTitles();
    await searchFor("ai");

    // Hide clickbait is on in the demo, so the clickbait AI video is left out.
    expect(resultTitles()).toEqual(["Already watched agent build", "Agents with memory", "Intro to transformers"]);
  });

  it("finds clickbait by its honest title once Hide clickbait is off, showing whichever title Honest titles picks", async () => {
    renderApp();
    await feedTitles();
    await toggleFilters("Hide clickbait");
    await searchFor("small ai tip");
    expect(resultTitles()).toEqual(["A small AI tip"]);

    await userEvent.click(screen.getByRole("button", { name: "Back to feed" }));
    await toggleFilters("Honest titles");
    await searchFor("small ai tip");
    expect(resultTitles()).toEqual(["YOU WON'T BELIEVE this AI trick"]);
  });

  it("pins a result to the current feed with +", async () => {
    renderApp();
    expect((await feedTitles())[0]).not.toBe("Gardening for beginners");
    await searchFor("gardening");

    await userEvent.click(screen.getByRole("button", { name: "Add Gardening for beginners to this session" }));
    expect(within(resultsPage()).getByText("In this session")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to feed" }));
    expect((await feedTitles())[0]).toBe("Gardening for beginners");
  });

  it("plays a result as the feed does and stays on the results", async () => {
    renderApp();
    await feedTitles();
    await searchFor("transformers");

    await userEvent.click(screen.getByRole("button", { name: "Intro to transformers" }));

    expect(window.open).toHaveBeenCalledWith(expect.stringContaining("youtube.com/results"), "_blank", "noopener");
    expect(resultsPage()).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to feed" }));
    expect(screen.getByRole("region", { name: "Watching now" })).toHaveTextContent("Intro to transformers");
  });

  it("says what to try when nothing matches", async () => {
    renderApp();
    await feedTitles();
    await searchFor("zzz");

    expect(screen.getByRole("heading", { level: 2, name: '0 results for "zzz"' })).toBeInTheDocument();
    expect(screen.getByText("No videos match that search. Try a channel name or topic.")).toBeInTheDocument();
  });

  it("is left, and the box cleared, when you switch tabs", async () => {
    renderApp();
    await feedTitles();
    await searchFor("ai");

    await userEvent.click(within(screen.getByRole("navigation", { name: "Feeds" })).getByRole("button", { name: "Learn" }));

    expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Learn" })).toBeInTheDocument();
    expect(box()).toHaveValue("");
  });

  it("keeps a new feed you haven't named open, so results are added to it", async () => {
    renderApp();
    await feedTitles();
    await userEvent.click(screen.getByRole("button", { name: "New feed" }));
    await searchFor("ai");

    expect(within(resultsPage()).getByText("Adding to: New feed")).toBeInTheDocument();
  });

  it("saves a result to a folder", async () => {
    renderApp();
    await feedTitles();
    await searchFor("transformers");

    await userEvent.click(within(resultsPage()).getByRole("button", { name: "Save Intro to transformers" }));
    await userEvent.click(within(within(resultsPage()).getByRole("group", { name: "Save to" })).getByRole("button", { name: "Weekend" }));

    expect(within(resultsPage()).getByRole("button", { name: "Save Intro to transformers, saved" })).toBeInTheDocument();
  });
});

describe("recent searches", () => {
  it("remembers searches across a reload, newest first", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await feedTitles();
    await searchFor("Tennis  Highlights");
    unmount();

    renderApp({ storage });
    await userEvent.click(box());
    expect(optionNames()).toEqual(["tennis highlights", "mcp server", "premier league highlights"]);
  });

  it("starts with none when an older save has no recent searches, keeping the rest", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await feedTitles();
    unmount();
    const saved = storage.saved() as { version: number; state: Record<string, unknown> };
    const older = Object.fromEntries(Object.entries(saved.state).filter(([key]) => key !== "recentSearches"));

    renderApp({ storage: memoryStorage({ ...saved, state: older }) });
    await userEvent.click(box());
    expect(box()).toHaveAttribute("aria-expanded", "false");
  });

  it("ignores saved recent searches that aren't a list of words", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await feedTitles();
    unmount();
    const saved = storage.saved() as { version: number; state: Record<string, unknown> };

    renderApp({ storage: memoryStorage({ ...saved, state: { ...saved.state, recentSearches: [42] } }) });
    await userEvent.click(box());
    expect(optionNames()).toEqual(["mcp server", "premier league highlights"]);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("voice search", () => {
  const mic = () => screen.getByRole("button", { name: /^(Search with your voice|Stop listening)$/ });

  it("explains why it can't start when the browser has no speech recognition", async () => {
    renderApp();
    await userEvent.click(mic());

    expect(screen.getByRole("alert")).toHaveTextContent("Voice search isn't available in this browser. Try Chrome, Edge or Safari.");
  });

  it("fills the box with what you say", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    renderApp();
    await userEvent.click(mic());
    expect(mic()).toHaveAccessibleName("Stop listening");
    expect(mic()).toHaveAttribute("aria-pressed", "true");
    expect(box()).toHaveAttribute("placeholder", "Listening…");

    recognition().hear("premier league");
    recognition().end();

    expect(box()).toHaveValue("premier league");
    expect(box()).toHaveFocus();
    expect(mic()).toHaveAccessibleName("Search with your voice");
  });

  it("says so when the microphone is blocked", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    renderApp();
    await userEvent.click(mic());

    recognition().fail("not-allowed");

    expect(screen.getByRole("alert")).toHaveTextContent("Microphone access is blocked. Allow it for this page to search by voice.");
    expect(mic()).toHaveAttribute("aria-pressed", "false");
  });

  it("stops when you press the mic again", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    renderApp();
    await userEvent.click(mic());
    await userEvent.click(mic());

    expect(mic()).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
