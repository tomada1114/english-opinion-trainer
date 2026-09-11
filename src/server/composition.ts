import "server-only";

import { createFakeLlmPort } from "../ai/index";
import { readServerEnv } from "./env";

// Read once, at module load, so a malformed environment stops the server as it
// starts rather than showing up as a puzzling failure on some later request.
readServerEnv();

// The wired adapter is the fake, so the vendor's name below lives only in
// `@remarks` prose, never in code. That prose is load-bearing:
// `tests/ai-vendor-swap.test.ts` asserts this file still names the vendor
// somewhere, and a comment tidy that drops the mention turns that assertion,
// and the swap checklist it backs, red.
/**
 * The one line in this repository that decides which vendor answers.
 *
 * @remarks
 * The fake adapter is what makes `pnpm dev` work with nothing configured. A
 * provider adapter is swapped in here and nowhere else — no environment
 * variable selects between them at runtime, because that would move the
 * choice out of the file whose whole job is to hold it. Wiring
 * `createAnthropicAdapter({ apiKey: readServerEnv().ANTHROPIC_API_KEY })`
 * instead is the same one-line edit in the other direction.
 */
export const llm = createFakeLlmPort({
  response: {
    answer: "This answer comes from the fake LLM adapter, so it works with no API key.",
  },
});
