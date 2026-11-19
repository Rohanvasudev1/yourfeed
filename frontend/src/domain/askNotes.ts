import { z } from "zod";
import { MAX_REQUEST_CHARS } from "./assistant";

/** Starts every answer line in a video's notes. */
export const ANSWER_MARK = "✱";
/** Shortest line that counts as a question, `?` included. */
export const MIN_QUESTION_CHARS = 3;
/** Longest question the notes send, as for a Claude bar request (ADR 0006). */
export const MAX_QUESTION_CHARS = MAX_REQUEST_CHARS;
/** How long each word of a new answer waits after the one before it as it inks in. */
export const INK_WORD_MS = 45;

export const answerResultSchema = z.object({ answer: z.string().min(1), answeredBy: z.enum(["model", "rules"]) }).readonly();
export type AnswerResult = z.infer<typeof answerResultSchema>;

export const isAnswerLine = (line: string): boolean => line.trimStart().startsWith(ANSWER_MARK);

/** A line of at least MIN_QUESTION_CHARS ending in `?` that isn't itself an answer. The upper limit is checked when it's asked. */
export const isQuestionLine = (line: string): boolean => {
  const text = line.trim();
  return !isAnswerLine(line) && text.length >= MIN_QUESTION_CHARS && text.endsWith("?");
};

/** Indexes of the question lines with no answer line straight after them. */
function unansweredAt(lines: readonly string[]): number[] {
  return lines.flatMap((line, i) => (isQuestionLine(line) && !isAnswerLine(lines[i + 1] ?? "") ? [i] : []));
}

/** Every question in a note, trimmed, in order. */
export const questionsIn = (note: string): string[] => note.split("\n").filter(isQuestionLine).map((l) => l.trim());

/** The note's questions that have no answer yet, trimmed, in order. */
export function unansweredQuestions(note: string): string[] {
  const lines = note.split("\n");
  return unansweredAt(lines).map((i) => lines[i].trim());
}

/** The question on the caret's line, up to the caret, when that's a question: what Enter asks. */
export function questionBeforeCaret(note: string, caret: number): string | null {
  const before = note.slice(0, caret);
  const line = before.slice(before.lastIndexOf("\n") + 1);
  return isQuestionLine(line) ? line.trim() : null;
}

/** An answer as its ✱ line shows it: one line, so whatever the assistant sends fits after the mark. */
export const oneLine = (answer: string): string => answer.replace(/\s*\n\s*/g, " ").trim();

const answerLine = (answer: string) => `${ANSWER_MARK} ${oneLine(answer)}`;

/**
 * The note with `answer` on the line after the first unanswered `question`, or null when that
 * question is gone (deleted or already answered), so no answer lands in the wrong place.
 */
export function insertAnswer(note: string, question: string, answer: string): string | null {
  const lines = note.split("\n");
  const at = unansweredAt(lines).find((i) => lines[i].trim() === question);
  if (at === undefined) return null;
  return [...lines.slice(0, at + 1), answerLine(answer), ...lines.slice(at + 1)].join("\n");
}
