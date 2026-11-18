import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeShare, readShareFragment } from "./domain/share";
import { EVERYTHING_ORDER } from "./test/fixtures";
import { cardFor, feedTitles, renderApp } from "./test/renderApp";

const [FIRST, SECOND, THIRD] = EVERYTHING_ORDER;
const IDS: Readonly<Record<string, string>> = { [FIRST]: "demo-51", [SECOND]: "demo-52", [THIRD]: "demo-50" };

beforeEach(() => {
  vi.stubGlobal(
    "open",
    vi.fn(() => ({}) as Window),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const shareButton = () => screen.getByRole("button", { name: "Share" });
const panel = () => screen.getByRole("region", { name: "Share this feed" });
const inPanel = () => within(panel());
const pick = (title: string) => inPanel().getByRole("checkbox", { name: `Include ${title}` });
const usernameBox = () => inPanel().getByRole("textbox", { name: "Username to send this feed to" });

async function openShare() {
  await feedTitles();
  await userEvent.click(shareButton());
  return panel();
}

/** Reads back the share inside a copied link. */
async function copiedShare() {
  const link = await navigator.clipboard.readText();
  const fragment = readShareFragment(new URL(link).hash);
  return fragment && decodeShare(fragment);
}

describe("the Share panel", () => {
  it("opens from the Share button with every session video selected", async () => {
    renderApp();
    await userEvent.click(within(await cardFor(FIRST)).getByRole("button", { name: FIRST }));
    expect(shareButton()).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(shareButton());

    expect(shareButton()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toHaveTextContent("Everything · 3 videos · 1h. Untick anything you don't want to send.");
    expect(panel()).toHaveTextContent("Videos · 3 of 3 selected");
    for (const title of EVERYTHING_ORDER) expect(pick(title)).toBeChecked();
    expect(inPanel().getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))).toEqual(
      EVERYTHING_ORDER.map((title) => `Include ${title}`),
    );
  });

  it("counts what's ticked, and Select all / Clear all flip the whole list", async () => {
    renderApp();
    await openShare();

    await userEvent.click(pick(SECOND));
    expect(panel()).toHaveTextContent("Videos · 2 of 3 selected");
    expect(panel()).toHaveTextContent("Everything · 2 videos · 40m.");

    await userEvent.click(inPanel().getByRole("button", { name: "Select all" }));
    expect(panel()).toHaveTextContent("3 of 3 selected");

    await userEvent.click(inPanel().getByRole("button", { name: "Clear all" }));
    expect(panel()).toHaveTextContent("0 of 3 selected");
    for (const title of EVERYTHING_ORDER) expect(pick(title)).not.toBeChecked();
  });

  it("won't share nothing: Copy and Send are disabled until a video is picked", async () => {
    renderApp();
    await openShare();

    await userEvent.click(inPanel().getByRole("button", { name: "Clear all" }));

    expect(panel()).toHaveTextContent("Pick at least one video to share.");
    expect(inPanel().getByRole("button", { name: "Copy link" })).toBeDisabled();
    expect(inPanel().getByRole("button", { name: "Send" })).toBeDisabled();
    expect(inPanel().getByRole("textbox", { name: "Share link" })).toHaveValue("");

    await userEvent.click(pick(THIRD));
    expect(panel()).not.toHaveTextContent("Pick at least one video to share.");
    expect(inPanel().getByRole("button", { name: "Copy link" })).toBeEnabled();
  });

  it("closes with its close button and when you switch feeds", async () => {
    renderApp();
    await openShare();
    await userEvent.click(inPanel().getByRole("button", { name: "Close sharing" }));
    expect(screen.queryByRole("region", { name: "Share this feed" })).not.toBeInTheDocument();

    await userEvent.click(shareButton());
    await userEvent.click(screen.getByRole("button", { name: "Learn" }));
    await feedTitles();
    expect(screen.queryByRole("region", { name: "Share this feed" })).not.toBeInTheDocument();
  });

  it("is reachable and usable from the keyboard", async () => {
    renderApp();
    await feedTitles();
    shareButton().focus();
    await userEvent.keyboard("{Enter}");
    expect(panel()).toBeInTheDocument();

    pick(FIRST).focus();
    await userEvent.keyboard(" ");
    expect(panel()).toHaveTextContent("2 of 3 selected");
  });
});

describe("copying a share link", () => {
  it("puts a working #share= link for the ticked videos on the clipboard", async () => {
    userEvent.setup();
    renderApp();
    await openShare();
    await userEvent.click(pick(SECOND));

    await userEvent.click(inPanel().getByRole("button", { name: "Copy link" }));

    expect(inPanel().getByRole("alert")).toHaveTextContent("Link copied.");
    const link = await navigator.clipboard.readText();
    expect(link).toMatch(/#share=[A-Za-z0-9_-]+$/);
    expect(inPanel().getByRole("textbox", { name: "Share link" })).toHaveValue(link);
    expect(await copiedShare()).toEqual({ title: "Everything", videos: [IDS[FIRST], IDS[THIRD]] });
  });

  it("says so when copying fails", async () => {
    userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    renderApp();
    await openShare();

    await userEvent.click(inPanel().getByRole("button", { name: "Copy link" }));

    expect(await inPanel().findByRole("alert")).toHaveTextContent("Couldn't copy the link. Try again.");
  });

  it("asks you to copy by hand where the browser has no clipboard", async () => {
    renderApp();
    await openShare();
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });

    fireEvent.click(inPanel().getByRole("button", { name: "Copy link" }));

    expect(inPanel().getByRole("alert")).toHaveTextContent("Copying isn't available here. Select the link and copy it yourself.");
  });
});

describe("including my notes", () => {
  async function writeNoteOnFirst() {
    await userEvent.click(within(await cardFor(FIRST)).getByRole("button", { name: FIRST }));
    const watching = screen.getByRole("region", { name: "Watching now" });
    await userEvent.type(within(watching).getByRole("textbox", { name: `Notes on ${FIRST}` }), "Loops and tools");
  }

  it("offers notes only when a ticked video has some", async () => {
    renderApp();
    await openShare();
    expect(inPanel().queryByRole("checkbox", { name: /Include my notes/ })).not.toBeInTheDocument();
  });

  it("counts the videos with notes, warns who can read them, and puts them in the link", async () => {
    userEvent.setup();
    renderApp();
    await writeNoteOnFirst();
    await userEvent.click(shareButton());

    const include = inPanel().getByRole("checkbox", { name: "Include my notes (1 video)" });
    expect(include).not.toBeChecked();
    expect(panel()).not.toHaveTextContent("Anyone with the link can read these notes.");

    await userEvent.click(include);
    expect(panel()).toHaveTextContent("Anyone with the link can read these notes.");
    await userEvent.click(inPanel().getByRole("button", { name: "Copy link" }));

    expect(await copiedShare()).toEqual({
      title: "Everything",
      videos: [IDS[FIRST], IDS[SECOND], IDS[THIRD]],
      notes: { [IDS[FIRST]]: "Loops and tools" },
    });
  });

  it("leaves notes out of the link unless you include them", async () => {
    userEvent.setup();
    renderApp();
    await writeNoteOnFirst();
    await userEvent.click(shareButton());

    await userEvent.click(inPanel().getByRole("button", { name: "Copy link" }));

    expect(await copiedShare()).not.toHaveProperty("notes");
  });
});

describe("sending to a username", () => {
  it("checks the name before sending", async () => {
    renderApp();
    await openShare();
    const send = () => userEvent.click(inPanel().getByRole("button", { name: "Send" }));

    await send();
    expect(inPanel().getByRole("alert")).toHaveTextContent("Type a username first");

    await userEvent.type(usernameBox(), "ab");
    await send();
    expect(inPanel().getByRole("alert")).toHaveTextContent("Usernames are 3–20 letters, numbers, dots or underscores");

    await userEvent.type(usernameBox(), "{Backspace}");
    expect(inPanel().queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says who it was sent to, and won't send to the same person twice", async () => {
    renderApp();
    await openShare();

    await userEvent.type(usernameBox(), "@Sam.Lee{Enter}");
    expect(panel()).toHaveTextContent("Sent to @Sam.Lee");
    expect(usernameBox()).toHaveValue("");

    await userEvent.type(usernameBox(), "jo_99{Enter}");
    expect(panel()).toHaveTextContent("Sent to @Sam.Lee, @jo_99");

    await userEvent.type(usernameBox(), "sam.lee{Enter}");
    expect(inPanel().getByRole("alert")).toHaveTextContent("Already sent to @sam.lee");
  });

  it("says plainly that nothing is really sent", async () => {
    renderApp();
    await openShare();
    expect(panel()).toHaveTextContent("Demo only: nothing is actually sent to anyone.");
  });
});
