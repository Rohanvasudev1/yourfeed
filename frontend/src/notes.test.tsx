import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVERYTHING_ORDER, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, renderApp } from "./test/renderApp";

const [FIRST, SECOND] = EVERYTHING_ORDER;

beforeEach(() => {
  vi.stubGlobal(
    "open",
    vi.fn(() => ({}) as Window),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const watchingNow = () => screen.getByRole("region", { name: "Watching now" });
const finishedSection = () => screen.getByRole("region", { name: "Finished" });
const feedNotes = () => screen.getByRole("region", { name: "Feed notes" });
const notesOn = (region: HTMLElement, title: string) => within(region).getByRole("textbox", { name: `Notes on ${title}` });

async function playByTitle(title: string) {
  const card = await cardFor(title);
  await userEvent.click(within(card).getByRole("button", { name: title }));
}

async function openFeedNotes() {
  await userEvent.click(screen.getByRole("button", { name: /^Feed notes/ }));
}

describe("notes on a video", () => {
  it("has a notes box under Watching now and under each Finished video", async () => {
    renderApp();
    await playByTitle(FIRST);
    await userEvent.type(notesOn(watchingNow(), FIRST), "Loops and tools");
    await playByTitle(SECOND);

    expect(notesOn(finishedSection(), FIRST)).toHaveValue("Loops and tools");
    expect(notesOn(watchingNow(), SECOND)).toHaveValue("");
  });

  it("shows the same notes for a video in every feed", async () => {
    renderApp();
    await playByTitle(FIRST);
    await userEvent.type(notesOn(watchingNow(), FIRST), "Loops and tools");

    await userEvent.click(screen.getByRole("button", { name: "Learn" }));
    await playByTitle(FIRST);

    expect(notesOn(watchingNow(), FIRST)).toHaveValue("Loops and tools");
  });

  it("keeps focus and the cursor where they are while typing", async () => {
    renderApp();
    await playByTitle(FIRST);
    const box = notesOn(watchingNow(), FIRST);
    await userEvent.type(box, "hello world");

    await userEvent.type(box, ",", { initialSelectionStart: 5, initialSelectionEnd: 5 });

    expect(box).toHaveValue("hello, world");
    expect(box).toHaveFocus();
    expect(box).toHaveProperty("selectionStart", 6);
  });

  it("keeps notes after a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await playByTitle(FIRST);
    await userEvent.type(notesOn(watchingNow(), FIRST), "Loops and tools");
    await openFeedNotes();
    await userEvent.type(within(feedNotes()).getByRole("textbox", { name: "Notes on this whole feed" }), "Good session");
    unmount();

    renderApp({ storage });
    await feedTitles();
    await openFeedNotes();
    expect(notesOn(watchingNow(), FIRST)).toHaveValue("Loops and tools");
    expect(within(feedNotes()).getByRole("textbox", { name: "Notes on this whole feed" })).toHaveValue("Good session");
  });
});

describe("Feed notes", () => {
  it("starts collapsed and opens from the keyboard", async () => {
    renderApp();
    await feedTitles();
    const toggle = screen.getByRole("button", { name: /^Feed notes/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(feedNotes()).queryByRole("textbox")).not.toBeInTheDocument();

    toggle.focus();
    await userEvent.keyboard("{Enter}");

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(feedNotes()).getByText("Watch a video from this feed and it'll show up here, ready for notes.")).toBeInTheDocument();
  });

  it("lists every Finished and Watching now video with its notes, shared with the session rows", async () => {
    renderApp();
    await playByTitle(FIRST);
    await playByTitle(SECOND);
    await userEvent.type(notesOn(finishedSection(), FIRST), "Loops");
    await openFeedNotes();

    expect(screen.getByRole("button", { name: /^Feed notes/ })).toHaveTextContent("Everything · 2 videos · 1 with notes");
    const entries = within(feedNotes()).getAllByRole("listitem");
    expect(entries.map((e) => within(e).getByRole("heading").textContent)).toEqual([FIRST, SECOND]);
    expect(within(entries[0]).getByText("Finished")).toBeInTheDocument();
    expect(within(entries[1]).getByText("Watching now")).toBeInTheDocument();

    await userEvent.type(notesOn(feedNotes(), FIRST), " and tools");
    expect(notesOn(finishedSection(), FIRST)).toHaveValue("Loops and tools");
  });

  it("copies the feed's notes as Markdown", async () => {
    const user = userEvent.setup();
    renderApp();
    await playByTitle(FIRST);
    await user.type(notesOn(watchingNow(), FIRST), "Loops and tools");
    await playByTitle(SECOND);
    await openFeedNotes();
    await user.type(within(feedNotes()).getByRole("textbox", { name: "Notes on this whole feed" }), "Good session");

    await user.click(within(feedNotes()).getByRole("button", { name: "Copy all notes as Markdown" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Notes copied.");
    expect(await navigator.clipboard.readText()).toBe(
      [
        "# Everything notes",
        "",
        "Good session",
        "",
        "## Agents with memory",
        "Agent Workshop · 20 min · Finished",
        "https://www.youtube.com/results?search_query=Agents%20with%20memory%20Agent%20Workshop",
        "",
        "Loops and tools",
        "",
        "## Intro to transformers",
        "Model School · 20 min · Watching now",
        "https://www.youtube.com/results?search_query=Intro%20to%20transformers%20Model%20School",
        "",
        "_No notes yet_",
        "",
      ].join("\n"),
    );
  });
  it("says so when copying fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    renderApp();
    await feedTitles();
    await openFeedNotes();

    await user.click(within(feedNotes()).getByRole("button", { name: "Copy all notes as Markdown" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't copy the notes. Try again.");
  });

  it("asks you to copy by hand where the browser has no clipboard", async () => {
    renderApp();
    await feedTitles();
    await openFeedNotes();
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });

    fireEvent.click(within(feedNotes()).getByRole("button", { name: "Copy all notes as Markdown" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Copying isn't available here. Select the notes and copy them yourself.");
  });

  it("replaces an earlier message instead of hiding the newer one", async () => {
    renderApp();
    await playByTitle(FIRST);
    await userEvent.click(within(watchingNow()).getByRole("button", { name: `Dictate notes on ${FIRST}` }));
    expect(screen.getByRole("alert")).toHaveTextContent("Voice typing isn't available in this browser.");

    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );
    await playByTitle(SECOND);

    expect(screen.getByRole("alert")).toHaveTextContent("Your browser blocked the YouTube tab.");
  });
});

type ResultEvent = { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] };

class FakeRecognition {
  static last: FakeRecognition | undefined;
  continuous = false;
  interimResults = true;
  lang = "";
  onresult: ((event: ResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
  stop() {
    this.onend?.();
  }
  hear(transcript: string) {
    act(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript } }] }));
  }
  fail(error: string) {
    act(() => {
      this.onerror?.({ error });
      this.onend?.();
    });
  }
}

const recognition = () => {
  if (!FakeRecognition.last) throw new Error("Voice typing never started");
  return FakeRecognition.last;
};

describe("voice typing", () => {
  it("explains why it can't start when the browser has no speech recognition", async () => {
    renderApp();
    await playByTitle(FIRST);
    await userEvent.click(within(watchingNow()).getByRole("button", { name: `Dictate notes on ${FIRST}` }));

    expect(screen.getByRole("alert")).toHaveTextContent("Voice typing isn't available in this browser. Try Chrome, Edge or Safari.");
  });

  it("types what you say into the note until you stop it", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    renderApp();
    await playByTitle(FIRST);
    await userEvent.click(within(watchingNow()).getByRole("button", { name: `Dictate notes on ${FIRST}` }));
    const stop = within(watchingNow()).getByRole("button", { name: `Stop dictating notes on ${FIRST}` });
    expect(stop).toHaveAttribute("aria-pressed", "true");

    recognition().hear("loops and tools");
    recognition().hear(" with memory");
    expect(notesOn(watchingNow(), FIRST)).toHaveValue("Loops and tools with memory");

    await userEvent.click(stop);
    expect(within(watchingNow()).getByRole("button", { name: `Dictate notes on ${FIRST}` })).toHaveAttribute("aria-pressed", "false");
  });

  it("says so when the microphone is blocked", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    renderApp();
    await playByTitle(FIRST);
    await userEvent.click(within(watchingNow()).getByRole("button", { name: `Dictate notes on ${FIRST}` }));

    recognition().fail("not-allowed");

    expect(screen.getByRole("alert")).toHaveTextContent("Microphone access is blocked. Allow it for this page to dictate notes.");
    expect(within(watchingNow()).getByRole("button", { name: `Dictate notes on ${FIRST}` })).toHaveAttribute("aria-pressed", "false");
  });

  it("says so when it heard nothing, and stays quiet when stopped on purpose", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    renderApp();
    await playByTitle(FIRST);
    const mic = () => within(watchingNow()).getByRole("button", { name: /dictating|Dictate/ });
    await userEvent.click(mic());

    recognition().fail("aborted");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await userEvent.click(mic());
    recognition().fail("no-speech");
    expect(screen.getByRole("alert")).toHaveTextContent("Didn't catch anything. Tap the mic and try again.");
  });
});
