import type * as z from "zod";

import { elementsFor, type Level } from "../src/core/drill";
import { feedbackSchemaFor } from "../src/core/feedback";
import { buildFeedbackPrompt } from "../src/core/feedback-prompt";

/**
 * The schema and answer `tests/fixtures/llm/success.json` is recorded and
 * replayed against, shared between `tests/ai-port.test.ts` (the recording
 * block and the generic contract suite) and `tests/ai-anthropic.test.ts` (the
 * committed-fixture replay checks).
 *
 * @remarks
 * Kept in one place, outside either `.test.ts` file, because importing one
 * test file's module from another would re-run its top-level `describe`
 * blocks as a side effect of the import — this module has none, so importing
 * it costs nothing. `feedbackSchemaFor("prep", "short")` is one representative
 * shape, per `#12`: the fake adapter's own tests already assert every shape's
 * structural correctness, so this only needs one real, end-to-end confirmation
 * that a genuine model response parses.
 */
export const CONTRACT_SCHEMA = feedbackSchemaFor("prep", "short");

/** The value {@link CONTRACT_SCHEMA} must resolve to when a request succeeds. */
export const CONTRACT_ANSWER: z.infer<typeof CONTRACT_SCHEMA> = {
  structure: {
    point: { verdict: "present", reason: "States a clear recommendation." },
    reason: { verdict: "weak", reason: "The justification given is thin." },
  },
  fixes: [
    {
      before: "I think Kyoto is good.",
      after: "I recommend visiting Kyoto for its historic temples.",
      why: "Names a concrete reason instead of a vague opinion.",
    },
  ],
  rewrite: "I recommend visiting Kyoto for its historic temples.",
  grammar: [
    {
      excerpt: "Kyoto is good",
      correction: "Kyoto is a great choice",
      note: '"good" is vague here; a more specific adjective reads better.',
    },
  ],
};

/**
 * The topic and answer `#65`'s three `level-<level>` fixtures are recorded
 * and replayed against — unchanged across all three levels, so a level
 * fixture isolates the level variable rather than confounding it with a
 * topic or answer change. `structure`/`mode` match {@link CONTRACT_SCHEMA}'s.
 */
const LEVEL_FIXTURE_TOPIC_TEXT =
  "What is one place you would recommend to a friend visiting your country?";

/** Deliberately imperfect, so a real model call has something to fix. */
const LEVEL_FIXTURE_ANSWER =
  "I think Kyoto is a good city because it have many old temple and beautiful garden.";

/** The prompt `#65`'s `level-<level>` fixture is recorded and replayed against. */
export function buildLevelFixturePrompt(level: Level): string {
  return buildFeedbackPrompt({
    topicText: LEVEL_FIXTURE_TOPIC_TEXT,
    structure: "prep",
    elements: elementsFor("prep", "short"),
    level,
    mode: "short",
    answer: LEVEL_FIXTURE_ANSWER,
  });
}
