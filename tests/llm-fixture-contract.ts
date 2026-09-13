import type * as z from "zod";

import { feedbackSchemaFor } from "../src/core/feedback";

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
