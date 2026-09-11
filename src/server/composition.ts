import "server-only";

import type * as z from "zod";

import {
  createFakeLlmPort,
  type LlmError,
  type LlmPort,
  type LlmRequest,
} from "../ai/index";
import { elementsFor, MODES, STRUCTURE_TYPES } from "../core/drill";
import type { Result } from "../core/result";
import { readServerEnv } from "./env";
import { createFeedbackHandler } from "./handlers/feedback";

// Read once, at module load, so a malformed environment stops the server as it
// starts rather than showing up as a puzzling failure on some later request.
readServerEnv();

/**
 * A plausible feedback answer judging exactly `elements`, as the fake answers.
 *
 * @remarks
 * Each feedback schema is strict about which element keys `structure` holds,
 * so no single canned value satisfies all six structure × mode shapes — one
 * is built per shape. The rewrite stays within every mode's sentence ceiling.
 */
function cannedFeedback(elements: readonly string[]): unknown {
  return {
    structure: Object.fromEntries(
      elements.map((key) => [
        key,
        {
          verdict: "present",
          reason: "The fake LLM adapter judged this; no model read the answer.",
        },
      ]),
    ),
    fixes: [
      {
        before: "I think it is good.",
        after: "I think it is worth a visit.",
        why: "A specific phrase says more than a general one.",
      },
    ],
    rewrite:
      "This rewrite comes from the fake LLM adapter, so it works with no API key.",
    grammar: [],
  };
}

const CANNED_FEEDBACK: readonly unknown[] = STRUCTURE_TYPES.flatMap((structure) =>
  MODES.map((mode) => cannedFeedback(elementsFor(structure, mode))),
);

// The wired adapter is the fake, so the vendor's name below lives only in
// `@remarks` prose, never in code. That prose is load-bearing:
// `tests/ai-vendor-swap.test.ts` asserts this file still names the vendor
// somewhere, and a comment tidy that drops the mention turns that assertion,
// and the swap checklist it backs, red.
/**
 * The one place in this repository that decides which vendor answers.
 *
 * @remarks
 * The fake adapter is what makes `pnpm dev` work with nothing configured; it
 * answers each request with the canned feedback its schema accepts. A provider
 * adapter is swapped in here and nowhere else — no environment variable selects
 * between them at runtime, because that would move the choice out of the file
 * whose whole job is to hold it. Replacing this object with
 * `createAnthropicAdapter({ apiKey: readServerEnv().ANTHROPIC_API_KEY })` is
 * the edit in the other direction.
 */
const llm: LlmPort = {
  generate<TSchema extends z.ZodType>(
    request: LlmRequest<TSchema>,
  ): Promise<Result<z.infer<TSchema>, LlmError>> {
    const response = CANNED_FEEDBACK.find(
      (candidate) => request.schema.safeParse(candidate).success,
    );
    return createFakeLlmPort({ response }).generate(request);
  },
};

/**
 * The `POST /api/feedback` handler, re-exported by its Route Handler.
 *
 * @remarks
 * `log` discards on purpose. `console` is banned under `src/`, and no server
 * log sink is chosen yet; the fake's canned rewrite never crosses a sentence
 * ceiling, so nothing is lost until a real model is wired.
 */
export const feedbackHandler = createFeedbackHandler({
  llm,
  log: () => undefined,
});
