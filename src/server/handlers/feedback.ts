import * as z from "zod";

import type { LlmErrorCode, LlmPort } from "../../ai/index";
import { ANSWER_CEILING, checkAnswer } from "../../core/answer-rules";
import { getTopicById } from "../../core/content/index";
import { elementsFor, LEVELS } from "../../core/drill";
import { feedbackSchemaFor } from "../../core/feedback";
import { buildFeedbackPrompt, clampFeedback } from "../../core/feedback-prompt";
import { failure, readJsonBody } from "../http";

/**
 * What the feedback handler needs from the outside world.
 *
 * @remarks
 * Interfaces only, so a test drives the handler with a fake and
 * `src/server/composition.ts` alone decides what stands behind each.
 */
export interface FeedbackHandlerDependencies {
  /** The model that judges the answer. */
  readonly llm: LlmPort;

  /**
   * Where a server-side notice goes — today only `clampFeedback`'s report of a
   * rewrite over its mode's sentence ceiling. Injected because `console` is
   * banned under `src/`, so the sink is the composition root's choice.
   */
  readonly log: (message: string) => void;
}

/** The JSON body `POST /api/feedback` accepts. */
const feedbackRequestSchema = z.object({
  topicId: z.string(),
  answer: z.string(),
  level: z.enum(LEVELS),
});

/**
 * The HTTP status each port failure is reported as.
 *
 * @remarks
 * `satisfies` keeps the literal keys, so a member added to `LlmErrorCode` fails
 * to compile here rather than falling through to a default. `ERR_LLM_AUTH` is a
 * 500 because the credential that failed is the server's, not the caller's.
 */
const STATUS_BY_LLM_CODE = {
  ERR_LLM_AUTH: 500,
  ERR_LLM_RATE_LIMIT: 429,
  ERR_LLM_TIMEOUT: 504,
  ERR_LLM_INVALID_OUTPUT: 502,
  ERR_LLM_UNAVAILABLE: 503,
} as const satisfies Record<LlmErrorCode, number>;

/**
 * Builds the `POST /api/feedback` handler over the dependencies it is given.
 *
 * @remarks
 * Web standards only — a `Request` in, a `Response` out, nothing from `next` —
 * so a test drives it with `new Request(...)` and the Route Handler under
 * `src/app/` stays a one-line re-export.
 *
 * Every refusal comes before `llm.generate`, the step that costs money: the
 * origin gate before the body is even read, then the body, the topic, and the
 * answer. A `200` answers with the topic's `{ topicId, structure, mode, level }`
 * beside the clamped model output under `feedback`; the two are not merged
 * because both carry a `structure` key — the topic's structure type, and the
 * per-element verdicts.
 *
 * @returns The handler `src/app/api/feedback/route.ts` exports as `POST`.
 */
export function createFeedbackHandler(
  dependencies: FeedbackHandlerDependencies,
): (request: Request) => Promise<Response> {
  const { llm, log } = dependencies;

  return async function handleFeedback(request: Request): Promise<Response> {
    // Browsers set this header themselves and page script cannot override it,
    // so it screens out a cross-site browser request. A non-browser client can
    // send anything; the spend cap on the provider side is what bounds that.
    if (request.headers.get("sec-fetch-site") !== "same-origin") {
      return failure(
        403,
        "ERR_FORBIDDEN_ORIGIN",
        "This endpoint answers only same-origin requests from this app's own pages.",
      );
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.error;
    }

    const parsed = feedbackRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      return failure(
        400,
        "ERR_BAD_REQUEST",
        `The request body must be an object with a string \`topicId\`, a string \`answer\`, and a \`level\` of ${LEVELS.join(", ")}.`,
      );
    }
    const { topicId, level } = parsed.data;

    const topic = getTopicById(topicId);
    if (topic === undefined) {
      return failure(
        400,
        "ERR_BAD_REQUEST",
        "The `topicId` names no topic this app ships.",
      );
    }

    const checked = checkAnswer(parsed.data.answer, topic.mode);
    if (!checked.ok) {
      switch (checked.error) {
        case "empty":
          return failure(
            400,
            "ERR_BAD_REQUEST",
            "The `answer` must not be empty once trimmed.",
          );
        case "too-long":
          return failure(
            400,
            "ERR_ANSWER_TOO_LONG",
            `The \`answer\` must be at most ${String(ANSWER_CEILING[topic.mode])} characters once trimmed for a ${topic.mode} topic.`,
          );
        case "not-english":
          return failure(
            400,
            "ERR_ANSWER_NOT_ENGLISH",
            "The `answer` must be written in English.",
          );
      }
    }
    const answer = checked.value;

    const result = await llm.generate({
      schema: feedbackSchemaFor(topic.structure, topic.mode),
      prompt: buildFeedbackPrompt({
        topicText: topic.text,
        structure: topic.structure,
        elements: elementsFor(topic.structure, topic.mode),
        level,
        mode: topic.mode,
        answer,
      }),
      // A constant: the app is English-only, so the request carries no locale.
      outputLanguage: "en",
      // A client that hangs up aborts this, and the port stops paying for it.
      signal: request.signal,
    });

    // Never the provider's own error text, which can quote the request back.
    if (!result.ok) {
      return failure(
        STATUS_BY_LLM_CODE[result.error.code],
        result.error.code,
        "The language model could not answer this request.",
      );
    }

    return Response.json(
      {
        topicId: topic.id,
        structure: topic.structure,
        mode: topic.mode,
        level,
        feedback: clampFeedback(result.value, topic.mode, log),
      },
      { status: 200 },
    );
  };
}
