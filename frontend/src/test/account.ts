import type { AccountStatus, DeleteResult, UsernameAnswer } from "../domain/account";
import type { AccountPort } from "../ports";

type Answer<T> = T | Error;

type Script = Readonly<{
  status?: Answer<AccountStatus>;
  signOut?: Answer<void>;
  deleteData?: Answer<DeleteResult>;
  /** An error makes every username choice fail; otherwise each is kept unless another user has it. */
  chooseUsername?: Error;
  /** Usernames other users already have. */
  takenUsernames?: readonly string[];
  /** Whether the browser remembers being signed in; by default, whether the script says it is. */
  expectsSignedIn?: boolean;
}>;

export const NOT_SET_UP: AccountStatus = { kind: "unavailable" };
export const SIGNED_OUT: AccountStatus = { kind: "signedOut", signInFailed: false };
export const SIGNED_IN: AccountStatus = { kind: "signedIn", username: "you.here" };
/** Signed in for the first time: no username yet. */
export const NEW_USER: AccountStatus = { kind: "signedIn", username: null };

const TAKEN = "That username is taken. Try another.";

const settle = async <T>(answer: Answer<T>): Promise<T> => {
  if (answer instanceof Error) throw answer;
  return answer;
};

/** A stand-in account port: answers from the script (sign-in not set up by default) and counts each call. */
export function fakeAccount({
  status = NOT_SET_UP,
  signOut = undefined,
  deleteData = { revoked: true },
  chooseUsername = undefined,
  takenUsernames = [],
  expectsSignedIn = status === SIGNED_IN || status === NEW_USER,
}: Script = {}) {
  const calls = { signIn: 0, signOut: 0, deleteData: 0, chooseUsername: [] as string[] };
  const port: AccountPort = {
    status: () => settle(status),
    expectsSignedIn: () => expectsSignedIn,
    signIn: () => {
      calls.signIn += 1;
    },
    signOut: () => {
      calls.signOut += 1;
      return settle(signOut);
    },
    chooseUsername: (username) => {
      calls.chooseUsername.push(username);
      const answer: UsernameAnswer = takenUsernames.includes(username) ? { ok: false, problem: TAKEN } : { ok: true, username };
      return settle(chooseUsername ?? answer);
    },
    deleteData: () => {
      calls.deleteData += 1;
      return settle(deleteData);
    },
  };
  return { ...port, calls };
}
