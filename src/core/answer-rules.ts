import type { Mode } from "./drill";
import { err, ok, type Result } from "./result";

/**
 * The rules an answer must pass before it is sent for feedback, shared by the
 * browser and the server so the two cannot drift apart.
 *
 * @remarks
 * The drill page checks first so a refused answer never reaches the network;
 * the server checks again and is authoritative, because a non-browser client
 * can send anything.
 */

/**
 * The longest answer each mode accepts, in characters once trimmed.
 *
 * @remarks
 * A ceiling on what one request can spend, checked before the model is asked.
 */
export const ANSWER_CEILING = {
  short: 400,
  long: 1_200,
} as const satisfies Record<Mode, number>;

/** Why an answer was refused, in the order the rules are checked. */
export type AnswerViolation = "empty" | "too-long" | "not-english";

/** One Han, Hiragana or Katakana character. */
const CJK_CHARACTER = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/gu;

/** One unaccented Latin letter. */
const LATIN_LETTER = /[A-Za-z]/g;

/** Whether `answer` has more CJK characters than Latin letters. */
function isMostlyCjk(answer: string): boolean {
  const cjk = answer.match(CJK_CHARACTER)?.length ?? 0;
  const latin = answer.match(LATIN_LETTER)?.length ?? 0;
  return cjk > latin;
}

/**
 * `answer` trimmed, or the first rule it breaks for a topic in `mode`.
 *
 * @remarks
 * Length is checked before language, so an over-long CJK answer reports the
 * ceiling — the one limit a learner can act on without rewriting everything.
 */
export function checkAnswer(
  answer: string,
  mode: Mode,
): Result<string, AnswerViolation> {
  const trimmed = answer.trim();
  if (trimmed === "") {
    return err("empty");
  }
  if (trimmed.length > ANSWER_CEILING[mode]) {
    return err("too-long");
  }
  if (isMostlyCjk(trimmed)) {
    return err("not-english");
  }
  return ok(trimmed);
}
