import { Fragment } from "react";
import { ANSWER_MARK, INK_WORD_MS, isAnswerLine, isQuestionLine } from "../domain/askNotes";

type Props = Readonly<{
  value: string;
  waiting: readonly string[];
  inking: readonly string[];
}>;

/** A new answer's words, each fading in a little after the one before (prototype inkWords). */
function InkedWords({ text }: Readonly<{ text: string }>) {
  let word = 0;
  return text.split(/(\s+)/).map((part, i) =>
    !part || /^\s+$/.test(part) ? (
      part
    ) : (
      <span key={i} className="ink-word" style={{ animationDelay: `${word++ * INK_WORD_MS}ms` }}>
        {part}
      </span>
    ),
  );
}

function MirrorLine({ line, waiting, inking }: Readonly<{ line: string; waiting: readonly string[]; inking: readonly string[] }>) {
  if (isAnswerLine(line)) {
    const at = line.indexOf(ANSWER_MARK);
    const body = line.slice(at + ANSWER_MARK.length);
    const isNew = inking.includes(body.trim());
    return (
      <>
        {line.slice(0, at)}
        <span className="answer-line">
          <span className={isNew ? "answer-mark new" : "answer-mark"}>{ANSWER_MARK}</span>
          {isNew ? <InkedWords text={body} /> : body}
        </span>
      </>
    );
  }
  if (!isQuestionLine(line)) return line;
  return (
    <>
      <span className="question-line">{line}</span>
      {waiting.includes(line.trim()) && <span className="question-dot" />}
    </>
  );
}

/**
 * The visible text of a video's notes, drawn under its transparent text box: question lines
 * underlined, a dot by each one being answered, and answers in ink (prototype mirrorHTML).
 */
export function NoteMirror({ value, waiting, inking }: Props) {
  return (
    <div className="note-mirror" aria-hidden="true">
      {value.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && "\n"}
          <MirrorLine line={line} waiting={waiting} inking={inking} />
        </Fragment>
      ))}
      {/* Gives a trailing empty line its height, as the text box does. */}
      {"\n"}
    </div>
  );
}
