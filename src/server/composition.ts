import "server-only";

import { createAnthropicAdapter } from "../ai/index";
import { readServerEnv } from "./env";
import { createFeedbackHandler } from "./handlers/feedback";

// Read once, at module load, so a malformed environment stops the server as it
// starts rather than showing up as a puzzling failure on some later request.
const env = readServerEnv();

/**
 * The one place in this repository that decides which vendor answers.
 *
 * @remarks
 * A provider adapter is swapped in here and nowhere else — no environment
 * variable selects between them at runtime, because that would move the choice
 * out of the file whose whole job is to hold it. A missing
 * `ANTHROPIC_API_KEY` is not a boot failure: the adapter reports it as
 * `ERR_LLM_AUTH` on the first request that needs the model. Tests inject the
 * fake adapter into `createFeedbackHandler` directly instead.
 */
const llm = createAnthropicAdapter({
  apiKey: env.ANTHROPIC_API_KEY,
  model: "claude-haiku-4-5",
});

/**
 * The `POST /api/feedback` handler, re-exported by its Route Handler.
 *
 * @remarks
 * `log` discards on purpose. `console` is banned under `src/`, and no server
 * log sink is chosen yet, so a rewrite over its mode's sentence ceiling goes
 * unrecorded until one is.
 */
export const feedbackHandler = createFeedbackHandler({
  llm,
  log: () => undefined,
});
