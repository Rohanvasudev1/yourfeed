import type { AccountStatus, DeleteResult } from "../domain/account";
import type { AccountPort } from "../ports";

type Answer<T> = T | Error;

type Script = Readonly<{
  status?: Answer<AccountStatus>;
  signOut?: Answer<void>;
  deleteData?: Answer<DeleteResult>;
}>;

export const NOT_SET_UP: AccountStatus = { kind: "unavailable" };
export const SIGNED_OUT: AccountStatus = { kind: "signedOut", signInFailed: false };
export const SIGNED_IN: AccountStatus = { kind: "signedIn" };

const settle = async <T>(answer: Answer<T>): Promise<T> => {
  if (answer instanceof Error) throw answer;
  return answer;
};

/** A stand-in account port: answers from the script (sign-in not set up by default) and counts each call. */
export function fakeAccount({ status = NOT_SET_UP, signOut = undefined, deleteData = { revoked: true } }: Script = {}) {
  const calls = { signIn: 0, signOut: 0, deleteData: 0 };
  const port: AccountPort = {
    status: () => settle(status),
    signIn: () => {
      calls.signIn += 1;
    },
    signOut: () => {
      calls.signOut += 1;
      return settle(signOut);
    },
    deleteData: () => {
      calls.deleteData += 1;
      return settle(deleteData);
    },
  };
  return { ...port, calls };
}
