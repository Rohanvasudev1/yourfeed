import { IconListDetails } from "@tabler/icons-react";
import type { LogLine } from "../../domain/recipeLog";
import "./recipeLog.css";

type Props = Readonly<{
  feedName: string;
  log: readonly LogLine[];
  onClear: () => void;
}>;

/** The requests that shaped this feed, oldest first. Undone ones are greyed out and no longer sent as follow-ups (ADR 0009). */
export function RecipeLog({ feedName, log, onClear }: Props) {
  if (log.length === 0) return null;
  return (
    <section className="recipe-log" aria-label="Recipe log">
      <div className="recipe-log-head">
        <h2 className="recipe-log-title">
          <IconListDetails size={15} aria-hidden="true" />
          Recipe log
          <span className="muted small"> · {feedName}</span>
        </h2>
        <button type="button" className="recipe-log-clear" onClick={onClear}>
          Clear log
        </button>
      </div>
      <ol className="recipe-log-lines">
        {log.map((line) => (
          <li key={line.id} className={line.live ? "recipe-line" : "recipe-line undone"}>
            {!line.live && <span className="visually-hidden">Undone: </span>}
            <span className="recipe-request">{line.request}</span>
            <span aria-hidden="true"> → </span>
            <span className="recipe-summary">{line.summary}</span>
            {line.reply && <span className="recipe-reply"> · {line.reply}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
