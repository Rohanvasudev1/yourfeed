import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toSaved } from "./state/persistence";
import { SAVE_DELAY_MS } from "./state/usePersist";
import { DEMO_SEED } from "./state/seed";
import { fakeAccount, SIGNED_IN, SIGNED_OUT } from "./test/account";
import { EVERYTHING_ORDER, memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp, toggleFilters } from "./test/renderApp";
import { fakeServerState } from "./test/serverState";

const BAIT_TITLE = "YOU WON'T BELIEVE this AI trick";
const SAVE_FAILED = "Couldn't save your changes to your account.";
const LOAD_FAILED = "Couldn't load your feeds from your account.";

/** Saved state like the demo seed's, with clickbait shown under its bait title so it's visible in the feed. */
const withClickbait = () =>
  toSaved({ ...DEMO_SEED, filters: { ...DEMO_SEED.filters, hideClickbait: false, honestTitles: false } });

const filtersOf = (saved: unknown) => (saved as ReturnType<typeof toSaved>).state.filters;

const signedIn = () => fakeAccount({ status: SIGNED_IN });

describe("signed in, state lives on the server", () => {
  it("loads your state from the server, not the browser", async () => {
    const storage = memoryStorage();
    const server = fakeServerState(withClickbait());
    renderApp({ account: signedIn(), storage, serverState: server });

    expect(await feedTitles()).toContain(BAIT_TITLE);
    expect(storage.saved()).toBeNull();
  });

  it("saves your changes to the server, and leaves the browser's demo state alone", async () => {
    const storage = memoryStorage();
    const server = fakeServerState();
    renderApp({ account: signedIn(), storage, serverState: server });

    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    await toggleFilters("Hide clickbait");
    await waitFor(() => expect(filtersOf(server.saved()).hideClickbait).toBe(false));
    expect(storage.saved()).toBeNull();
  });

  it("starts a new account from the starting example, not from the browser's demo state", async () => {
    const storage = memoryStorage(withClickbait());
    renderApp({ account: signedIn(), storage, serverState: fakeServerState() });

    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
  });

  it("says when a save failed, and Try again saves it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const server = fakeServerState();
    renderApp({ account: signedIn(), serverState: server });
    await feedTitles();
    await waitFor(() => expect(server.saved()).not.toBeNull());

    server.failSaves(1);
    await toggleFilters("Hide clickbait");
    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_FAILED);
    expect(filtersOf(server.saved()).hideClickbait).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    await waitFor(() => expect(filtersOf(server.saved()).hideClickbait).toBe(false));
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
  });

  it("says when your state couldn't load, and Retry loads it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const server = fakeServerState(withClickbait());
    server.failLoads(1);
    const storage = memoryStorage();
    renderApp({ account: signedIn(), storage, serverState: server });

    expect(await screen.findByRole("alert")).toHaveTextContent(LOAD_FAILED);
    expect(server.calls.save).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await feedTitles()).toContain(BAIT_TITLE);
    expect(storage.saved()).toBeNull();
  });

  it("doesn't save the starting example over a server document this version can't open, until you change something", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unreadable = { version: 999, state: { from: "a newer Yourfeed" } };
    const server = fakeServerState(unreadable);
    renderApp({ account: signedIn(), serverState: server });

    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("saved state"), expect.anything());
    await new Promise((resolve) => setTimeout(resolve, SAVE_DELAY_MS * 2));
    expect(server.calls.save).toBe(0);
    expect(server.saved()).toEqual(unreadable);

    await toggleFilters("Hide clickbait");
    await waitFor(() => expect(filtersOf(server.saved()).hideClickbait).toBe(false));
  });

  it("offers Sign out when your state couldn't load, back to the demo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const server = fakeServerState();
    server.failLoads(1);
    const account = signedIn();
    renderApp({ account, serverState: server });

    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(account.calls.signOut).toBe(1);
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(server.calls.load).toBe(1);
  });

  it("signing out returns to the demo state, untouched", async () => {
    const demo = withClickbait();
    const storage = memoryStorage(demo);
    const server = fakeServerState();
    renderApp({ account: signedIn(), storage, serverState: server });
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    await toggleFilters("Hide view counts");

    await userEvent.click(screen.getByRole("button", { name: "Your account" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(await feedTitles()).toContain(BAIT_TITLE);
    expect(storage.saved()).toEqual(demo);
  });

  it("Delete my data also returns to the demo state, untouched", async () => {
    const demo = withClickbait();
    const storage = memoryStorage(demo);
    renderApp({ account: signedIn(), storage, serverState: fakeServerState() });
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);

    await userEvent.click(screen.getByRole("button", { name: "Your account" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete my data" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete everything" }));

    expect(await feedTitles()).toContain(BAIT_TITLE);
    expect(storage.saved()).toEqual(demo);
  });

  it("opens your server state even when this browser didn't remember you were signed in", async () => {
    const storage = memoryStorage();
    renderApp({ account: fakeAccount({ status: SIGNED_IN, expectsSignedIn: false }), storage, serverState: fakeServerState(withClickbait()) });

    await waitFor(async () => expect(await feedTitles()).toContain(BAIT_TITLE));
  });

  it("shows the demo when this browser remembered a session that has since ended", async () => {
    const server = fakeServerState(withClickbait());
    renderApp({ account: fakeAccount({ status: SIGNED_OUT, expectsSignedIn: true }), storage: memoryStorage(), serverState: server });

    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(server.calls.load).toBe(0);
  });
});

describe("demo mode", () => {
  it("keeps state in the browser and never calls the server", async () => {
    const storage = memoryStorage();
    const server = fakeServerState();
    renderApp({ account: fakeAccount({ status: SIGNED_OUT }), storage, serverState: server });

    await feedTitles();
    await toggleFilters("Hide clickbait");
    await waitFor(() => expect(filtersOf(storage.saved()).hideClickbait).toBe(false));
    expect(server.calls).toEqual({ load: 0, save: 0 });
  });
});
