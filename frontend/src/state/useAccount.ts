import { useCallback, useEffect, useState } from "react";
import { ACCOUNT_TEXT, type AccountStatus } from "../domain/account";
import { cleanUsername, usernameProblem as ruleProblem } from "../domain/username";
import type { AccountPort } from "../ports";
import { FLASH_MS, useTimedValue } from "./useTimedValue";

const SIGNED_OUT: AccountStatus = { kind: "signedOut", signInFailed: false };

export type AccountControls = Readonly<{
  /** `null` until the server says, or when it can't: the app stays in the demo either way. */
  status: AccountStatus | null;
  /** Whether the server has answered, or failed to, the first time it was asked. */
  checked: boolean;
  /** The last sign-out or Delete my data problem, shown in the menu. */
  problem: string | null;
  busy: boolean;
  /** A sign-in that just failed, said once on return from Google. */
  flash: string | null;
  /** Why the last username choice wasn't kept; null when there's nothing to say. */
  usernameProblem: string | null;
  signIn: () => void;
  /** Checks the typed username against the rules, then asks the server for it. */
  chooseUsername: (typed: string) => void;
  signOut: () => void;
  deleteData: () => void;
}>;

/** The visitor's account: asks once whether they're signed in, then signs out or deletes on request. */
export function useAccount(account: AccountPort): AccountControls {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useTimedValue<string>(FLASH_MS);
  const [usernameProblem, setUsernameProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    account
      .status()
      .then((answer) => {
        if (!live) return;
        setStatus(answer);
        if (answer.kind === "signedOut" && answer.signInFailed) showFlash(ACCOUNT_TEXT.signInFailed);
      })
      .catch((err: unknown) => console.error("Couldn't find out whether you're signed in", err))
      .finally(() => {
        if (live) setChecked(true);
      });
    return () => {
      live = false;
    };
  }, [account, showFlash]);

  const run = useCallback(
    async (action: () => Promise<string | null>, failure: string, what: string) => {
      setBusy(true);
      setProblem(null);
      setUsernameProblem(null);
      try {
        setProblem(await action());
        setStatus(SIGNED_OUT);
      } catch (err: unknown) {
        console.error(`Couldn't ${what}`, err);
        setProblem(failure);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const signOut = useCallback(
    () => void run(async () => (await account.signOut(), null), ACCOUNT_TEXT.signOutFailed, "sign out"),
    [account, run],
  );
  const deleteData = useCallback(
    () => void run(async () => ((await account.deleteData()).revoked ? null : ACCOUNT_TEXT.notRevoked), ACCOUNT_TEXT.deleteFailed, "delete your data"),
    [account, run],
  );

  const chooseUsername = useCallback(
    (typed: string) => {
      // Usernames are kept lowercase, so uniqueness ignores case.
      const name = cleanUsername(typed).toLowerCase();
      const broken = ruleProblem(name, []);
      setUsernameProblem(broken);
      if (broken) return;
      setBusy(true);
      account
        .chooseUsername(name)
        .then((answer) => {
          if (answer.ok) setStatus({ kind: "signedIn", username: answer.username });
          else setUsernameProblem(answer.problem);
        })
        .catch((err: unknown) => {
          console.error("Couldn't save your username", err);
          setUsernameProblem(ACCOUNT_TEXT.usernameFailed);
        })
        .finally(() => setBusy(false));
    },
    [account],
  );

  return { status, checked, problem, busy, flash, usernameProblem, signIn: account.signIn, signOut, chooseUsername, deleteData };
}
