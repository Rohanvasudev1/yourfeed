import { useId, useState, type FormEvent } from "react";
import { ACCOUNT_TEXT } from "../../domain/account";
import { USERNAME_LENGTH } from "../../domain/username";
import type { AccountControls } from "../../state/useAccount";
import "./onboarding.css";

type Props = Readonly<{ account: AccountControls }>;

/** First sign-in's question (ADR 0013): the username Share and Blend use. Signing out is the way to leave. */
export function UsernamePrompt({ account }: Props) {
  const [typed, setTyped] = useState("");
  const ids = useId();
  const [titleId, hintId, problemId] = [`${ids}-title`, `${ids}-hint`, `${ids}-problem`];
  const problem = account.usernameProblem;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    account.chooseUsername(typed);
  };

  return (
    <form className="onboarding-card" aria-labelledby={titleId} onSubmit={submit}>
      <h2 id={titleId} className="onboarding-title">
        {ACCOUNT_TEXT.chooseUsername}
      </h2>
      <p id={hintId} className="onboarding-hint">
        {ACCOUNT_TEXT.usernameHint}
      </p>
      <label className="onboarding-label" htmlFor={`${ids}-input`}>
        {ACCOUNT_TEXT.usernameLabel}
      </label>
      <div className="onboarding-row">
        <input
          id={`${ids}-input`}
          type="text"
          value={typed}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={USERNAME_LENGTH.max + 1}
          aria-describedby={problem ? `${hintId} ${problemId}` : hintId}
          aria-invalid={problem ? true : undefined}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button type="submit" disabled={account.busy}>
          {ACCOUNT_TEXT.saveUsername}
        </button>
      </div>
      {problem && (
        <p id={problemId} className="onboarding-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="onboarding-actions">
        <button type="button" className="text-button" onClick={account.signOut} disabled={account.busy}>
          Sign out
        </button>
      </div>
    </form>
  );
}
