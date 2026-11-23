import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeAccount, SIGNED_IN, SIGNED_OUT } from "./test/account";
import { feedTitles, renderApp } from "./test/renderApp";

const avatar = () => screen.getByRole("button", { name: "Your account" });
const menu = () => screen.getByRole("dialog", { name: "Your account" });
const inMenu = (name: string) => within(menu()).getByRole("button", { name });
const READS = "Reads your YouTube subscriptions, likes and playlists, read-only.";
const TESTING = "Yourfeed is in testing mode, so Google will warn that the app isn't verified.";

async function openMenu(account: ReturnType<typeof fakeAccount>) {
  renderApp({ account });
  await feedTitles();
  await userEvent.click(avatar());
  return menu();
}

describe("signing in", () => {
  it("says signing in isn't set up when the server has no Google secrets, and the demo still works", async () => {
    const opened = await openMenu(fakeAccount());
    expect(await within(opened).findByText("Signing in isn't set up here.")).toBeInTheDocument();
    expect(within(opened).queryByRole("button", { name: "Sign in with Google" })).not.toBeInTheDocument();
    expect(opened).toHaveTextContent("@you · demo account");
    expect(await feedTitles()).not.toHaveLength(0);
  });

  it("offers Sign in with Google, saying what it reads and that the app is in testing mode", async () => {
    const account = fakeAccount({ status: SIGNED_OUT });
    const opened = await openMenu(account);
    const signIn = await within(opened).findByRole("button", { name: "Sign in with Google" });
    expect(opened).toHaveTextContent(READS);
    expect(opened).toHaveTextContent(TESTING);
    await userEvent.click(signIn);
    expect(account.calls.signIn).toBe(1);
  });

  it("reaches Sign in with Google by keyboard", async () => {
    renderApp({ account: fakeAccount({ status: SIGNED_OUT }) });
    await feedTitles();
    avatar().focus();
    await userEvent.keyboard("{Enter}");
    const signIn = await within(menu()).findByRole("button", { name: "Sign in with Google" });
    for (let presses = 0; presses < 20 && document.activeElement !== signIn; presses++) await userEvent.tab();
    expect(signIn).toHaveFocus();
  });

  it("says so when Google sign-in didn't work", async () => {
    renderApp({ account: fakeAccount({ status: { kind: "signedOut", signInFailed: true } }) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Signing in with Google didn't work. Try again.");
  });

  it("stays in the demo, quietly, when the server can't say whether you're signed in", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const opened = await openMenu(fakeAccount({ status: new Error("down") }));
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(opened).toHaveTextContent("@you · demo account");
    expect(within(opened).queryByRole("button", { name: "Sign in with Google" })).not.toBeInTheDocument();
  });
});

describe("signed in", () => {
  it("says you're signed in with Google and offers sign out and Delete my data", async () => {
    const opened = await openMenu(fakeAccount({ status: SIGNED_IN }));
    expect(await within(opened).findByText("Signed in with Google")).toBeInTheDocument();
    expect(opened).not.toHaveTextContent("demo account");
    expect(inMenu("Sign out")).toBeInTheDocument();
    expect(inMenu("Delete my data")).toBeInTheDocument();
  });

  it("signs out back to the demo", async () => {
    const account = fakeAccount({ status: SIGNED_IN });
    await openMenu(account);
    await userEvent.click(await within(menu()).findByRole("button", { name: "Sign out" }));
    expect(account.calls.signOut).toBe(1);
    expect(await within(menu()).findByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
    expect(menu()).toHaveTextContent("@you · demo account");
  });

  it("says when signing out didn't work, and stays signed in", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await openMenu(fakeAccount({ status: SIGNED_IN, signOut: new Error("down") }));
    await userEvent.click(await within(menu()).findByRole("button", { name: "Sign out" }));
    expect(await within(menu()).findByRole("alert")).toHaveTextContent("Couldn't sign out. Try again.");
    expect(inMenu("Sign out")).toBeInTheDocument();
  });
});

describe("Delete my data", () => {
  it("asks first, and Cancel keeps everything", async () => {
    const account = fakeAccount({ status: SIGNED_IN });
    await openMenu(account);
    await userEvent.click(await within(menu()).findByRole("button", { name: "Delete my data" }));
    expect(menu()).toHaveTextContent("Delete your account and everything Yourfeed stored for it, and remove its access to your Google account? This can't be undone.");
    expect(inMenu("Cancel")).toHaveFocus();
    await userEvent.click(inMenu("Cancel"));
    expect(account.calls.deleteData).toBe(0);
    expect(inMenu("Delete my data")).toBeInTheDocument();
  });

  it("deletes the account once confirmed and returns to the demo", async () => {
    const account = fakeAccount({ status: SIGNED_IN });
    await openMenu(account);
    await userEvent.click(await within(menu()).findByRole("button", { name: "Delete my data" }));
    await userEvent.click(inMenu("Yes, delete everything"));
    expect(account.calls.deleteData).toBe(1);
    expect(await within(menu()).findByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
    expect(within(menu()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says how to remove Google access by hand when Google didn't confirm it", async () => {
    await openMenu(fakeAccount({ status: SIGNED_IN, deleteData: { revoked: false } }));
    await userEvent.click(await within(menu()).findByRole("button", { name: "Delete my data" }));
    await userEvent.click(inMenu("Yes, delete everything"));
    expect(await within(menu()).findByRole("alert")).toHaveTextContent(
      "Your data is deleted, but Google didn't confirm it removed Yourfeed's access. Remove it at myaccount.google.com/permissions.",
    );
  });

  it("says when deleting didn't work, and stays signed in", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await openMenu(fakeAccount({ status: SIGNED_IN, deleteData: new Error("down") }));
    await userEvent.click(await within(menu()).findByRole("button", { name: "Delete my data" }));
    await userEvent.click(inMenu("Yes, delete everything"));
    expect(await within(menu()).findByRole("alert")).toHaveTextContent("Couldn't delete your data. Try again.");
    expect(inMenu("Delete my data")).toBeInTheDocument();
  });
});
