import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerWith, deferred, scriptedAssistant } from "./test/assistant";
import { EVERYTHING_ORDER, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, renderApp } from "./test/renderApp";
import type { AnswerResult } from "./domain/askNotes";

const [FIRST] = EVERYTHING_ORDER;
const FIRST_ID = "demo-51";
const ANSWER = "An agent is a model running in a loop.";
const HINT = "Ask Claude: end a line with ? and press Enter. The answer appears on the next line.";

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
const notesBox = () => within(watchingNow()).getByRole<HTMLTextAreaElement>("textbox", { name: `Notes on ${FIRST}` });
const askButton = () => within(watchingNow()).getByRole("button", { name: `Answer my last question in notes on ${FIRST}` });

async function watchFirst(assistant = scriptedAssistant(undefined, { answerQuestion: () => answerWith(ANSWER) })) {
  const storage = memoryStorage();
  const view = renderApp({ assistant, storage });
  const card = await cardFor(FIRST);
  await userEvent.click(within(card).getByRole("button", { name: FIRST }));
  return { assistant, storage, ...view };
}

/** Waits for an answer generously: the suite runs alongside others on a busy machine. */
const eventually = (check: () => void) => vi.waitFor(check, { timeout: 10_000 });

/** Sets the note's text in one go, as pasting does. */
const paste = (text: string) => fireEvent.change(notesBox(), { target: { value: text } });

describe("asking in a video's notes", () => {
  it("answers a question on the next line when you press Enter, keeping focus and the cursor", async () => {
    // Settled by hand after the keypress, as a real answer always arrives after the Enter is typed.
    const pending = deferred<AnswerResult>();
    const { assistant } = await watchFirst(scriptedAssistant(undefined, { answerQuestion: () => pending.promise }));

    await userEvent.type(notesBox(), "What is an agent?{Enter}");
    pending.resolve(answerWith(ANSWER));

    await eventually(() => expect(notesBox()).toHaveValue(`What is an agent?\n✱ ${ANSWER}\n`));
    expect(assistant.questions).toEqual([{ videoId: FIRST_ID, question: "What is an agent?" }]);
    expect(notesBox()).toHaveFocus();
    expect(notesBox()).toHaveProperty("selectionStart", notesBox().value.length);

    await userEvent.type(notesBox(), "Makes sense");
    expect(notesBox()).toHaveValue(`What is an agent?\n✱ ${ANSWER}\nMakes sense`);
  });

  it("keeps the cursor on the same text when an answer lands above it", async () => {
    const pending = deferred<AnswerResult>();
    await watchFirst(scriptedAssistant(undefined, { answerQuestion: () => pending.promise }));
    await userEvent.type(notesBox(), "Why loops?{Enter}tools");
    await userEvent.type(notesBox(), "!", { initialSelectionStart: 13, initialSelectionEnd: 13 });

    pending.resolve(answerWith("Loops let it retry."));

    await eventually(() => expect(notesBox()).toHaveValue("Why loops?\n✱ Loops let it retry.\nto!ols"));
    const caret = notesBox().value.indexOf("!") + 1;
    expect(notesBox()).toHaveFocus();
    expect(notesBox()).toHaveProperty("selectionStart", caret);
    expect(notesBox()).toHaveProperty("selectionEnd", caret);
  });

  it("only asks lines of at least 3 characters that end in ?, and not on Shift+Enter", async () => {
    const { assistant } = await watchFirst();

    await userEvent.type(notesBox(), "Agents{Enter}a?{Enter}Loops?{Shift>}{Enter}{/Shift}✱ Is this an answer?{Enter}");

    expect(assistant.questions).toEqual([]);
  });

  it("asks you to keep questions under 300 characters", async () => {
    const { assistant } = await watchFirst();
    paste(`${"x".repeat(300)}?`);

    await userEvent.type(notesBox(), "{Enter}", { initialSelectionStart: 301, initialSelectionEnd: 301 });

    expect(within(watchingNow()).getByText("Keep questions under 300 characters")).toBeInTheDocument();
    expect(assistant.questions).toEqual([]);
  });

  it("shows how to ask under the notes box", async () => {
    await watchFirst();
    expect(within(watchingNow()).getByText(HINT)).toBeInTheDocument();
  });

  it("says when the answer couldn't be fetched, and inserts nothing", async () => {
    await watchFirst(scriptedAssistant(undefined, { answerQuestion: () => Promise.reject(new Error("offline")) }));

    await userEvent.type(notesBox(), "What is an agent?{Enter}");

    expect(await within(watchingNow()).findByText("Couldn't answer that right now. Try again.")).toBeInTheDocument();
    expect(notesBox()).toHaveValue("What is an agent?\n");
  });

  it("keeps answers after a reload, since they're part of the notes", async () => {
    const pending = deferred<AnswerResult>();
    const { storage, unmount } = await watchFirst(scriptedAssistant(undefined, { answerQuestion: () => pending.promise }));
    await userEvent.type(notesBox(), "What is an agent?{Enter}");
    pending.resolve(answerWith(ANSWER));
    await eventually(() => expect(notesBox()).toHaveValue(`What is an agent?\n✱ ${ANSWER}\n`));
    unmount();

    renderApp({ storage });
    await feedTitles();
    expect(notesBox()).toHaveValue(`What is an agent?\n✱ ${ANSWER}\n`);
  });

  it("doesn't ask in the note on the whole feed", async () => {
    const { assistant } = await watchFirst();
    await userEvent.click(screen.getByRole("button", { name: /^Feed notes/ }));
    const feedNote = within(screen.getByRole("region", { name: "Feed notes" })).getByRole("textbox", { name: "Notes on this whole feed" });

    await userEvent.type(feedNote, "What is an agent?{Enter}");

    expect(assistant.questions).toEqual([]);
    expect(screen.queryByRole("button", { name: "Answer my last question in notes on this whole feed" })).not.toBeInTheDocument();
  });
});

describe("the ✱ button", () => {
  it("answers the last unanswered question", async () => {
    const { assistant } = await watchFirst();
    paste(`What is an agent?\n✱ Already answered.\nWhat is a tool?\nloops\nWhy memory?\nend`);

    await userEvent.click(askButton());

    await eventually(() =>
      expect(notesBox()).toHaveValue(`What is an agent?\n✱ Already answered.\nWhat is a tool?\nloops\nWhy memory?\n✱ ${ANSWER}\nend`),
    );
    expect(assistant.questions).toEqual([{ videoId: FIRST_ID, question: "Why memory?" }]);
  });

  it("explains how to ask when the notes have no question", async () => {
    const { assistant } = await watchFirst();
    paste("Loops and tools");

    await userEvent.click(askButton());

    expect(within(watchingNow()).getByText("Write a question in your notes ending in ?, then press Enter")).toBeInTheDocument();
    expect(assistant.questions).toEqual([]);
  });

  it("says when every question is already answered, then shows the hint again once one is asked", async () => {
    await watchFirst();
    paste("What is an agent?\n✱ Already answered.");

    await userEvent.click(askButton());
    expect(within(watchingNow()).getByText("Your questions are already answered. Write a new line ending in ?")).toBeInTheDocument();

    await userEvent.type(notesBox(), "{Enter}Why memory?{Enter}");
    expect(await within(watchingNow()).findByText(HINT)).toBeInTheDocument();
  });

  it("is reachable from the keyboard", async () => {
    const { assistant } = await watchFirst();
    await userEvent.type(notesBox(), "Why memory?");

    await userEvent.tab();
    expect(askButton()).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await eventually(() => expect(notesBox()).toHaveValue(`Why memory?\n✱ ${ANSWER}`));
    expect(assistant.questions).toHaveLength(1);
  });
});

describe("while an answer is on its way", () => {
  it("marks the notes busy and doesn't ask the same question twice", async () => {
    const pending = deferred<AnswerResult>();
    const { assistant } = await watchFirst(scriptedAssistant(undefined, { answerQuestion: () => pending.promise }));

    await userEvent.type(notesBox(), "Why memory?");
    await userEvent.click(askButton());
    await userEvent.click(askButton());
    await userEvent.type(notesBox(), "{Enter}", { initialSelectionStart: 11, initialSelectionEnd: 11 });

    expect(notesBox()).toHaveAttribute("aria-busy", "true");
    expect(assistant.questions).toHaveLength(1);

    pending.resolve(answerWith(ANSWER));
    await eventually(() => expect(notesBox()).toHaveAttribute("aria-busy", "false"));
    expect(notesBox().value.match(/✱/g)).toHaveLength(1);
  });

  it("drops the answer if you deleted the question meanwhile", async () => {
    const pending = deferred<AnswerResult>();
    await watchFirst(scriptedAssistant(undefined, { answerQuestion: () => pending.promise }));
    await userEvent.type(notesBox(), "Why memory?{Enter}");

    await userEvent.clear(notesBox());
    await userEvent.type(notesBox(), "Changed my mind");
    pending.resolve(answerWith(ANSWER));

    await eventually(() => expect(notesBox()).toHaveAttribute("aria-busy", "false"));
    expect(notesBox()).toHaveValue("Changed my mind");
  });
});
