import { initialOf } from "../../domain/blend";

/** "You" and the partner's initial, overlapping. Decorative: the heading names you both. */
export function BlendAvatars({ name }: Readonly<{ name: string }>) {
  return (
    <span className="blend-avatars" aria-hidden="true">
      <span className="blend-avatar you">You</span>
      <span className="blend-avatar them">{initialOf(name)}</span>
    </span>
  );
}

/** "83% match" with a small bar; the bar only repeats the number. */
export function MatchScore({ score }: Readonly<{ score: number }>) {
  return (
    <span className="blend-score">
      {score}% match
      <span className="blend-score-bar" aria-hidden="true">
        <span style={{ width: `${score}%` }} />
      </span>
    </span>
  );
}
