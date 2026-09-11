import * as z from "zod";

import type { Topic } from "../../../../../core/content/index";
import type { Level } from "../../../../../core/drill";
import { type Feedback, feedbackSchemaFor } from "../../../../../core/feedback";
import { err, ok, type Result } from "../../../../../core/result";

/**
 * Every `error.code` `POST /api/feedback` answers with that the drill page
 * has its own message for; anything else reads as `"unknown"`.
 */
const FEEDBACK_ERROR_CODES = [
  "ERR_BAD_REQUEST",
  "ERR_ANSWER_TOO_LONG",
  "ERR_ANSWER_NOT_ENGLISH",
  "ERR_FORBIDDEN_ORIGIN",
  "ERR_PAYLOAD_TOO_LARGE",
  "ERR_LLM_AUTH",
  "ERR_LLM_RATE_LIMIT",
  "ERR_LLM_TIMEOUT",
  "ERR_LLM_INVALID_OUTPUT",
  "ERR_LLM_UNAVAILABLE",
] as const;

/**
 * Why a feedback request failed: a code the endpoint answered with, or
 * `"unknown"` for a network failure, an unrecognised code, or a body that
 * does not match the contract.
 */
export type FeedbackErrorCode = (typeof FEEDBACK_ERROR_CODES)[number] | "unknown";

const errorBodySchema = z.object({ error: z.object({ code: z.string() }) });

function toFeedbackErrorCode(code: string): FeedbackErrorCode {
  return FEEDBACK_ERROR_CODES.find((known) => known === code) ?? "unknown";
}

/**
 * Asks `POST /api/feedback` to judge `answer` for `topic`.
 *
 * @remarks
 * A relative URL from the page is a same-origin browser request, which is
 * what the endpoint's `Sec-Fetch-Site` gate admits. The `200` body is
 * validated against the topic's own feedback schema rather than trusted, so
 * the rendering below never meets a shape it was not written for.
 */
export async function requestFeedback(
  topic: Topic,
  answer: string,
  level: Level,
): Promise<Result<Feedback, FeedbackErrorCode>> {
  let response: Response;
  try {
    response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId: topic.id, answer, level }),
    });
  } catch {
    return err("unknown");
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const failure = errorBodySchema.safeParse(body);
    return err(
      failure.success ? toFeedbackErrorCode(failure.data.error.code) : "unknown",
    );
  }

  const success = z
    .object({ feedback: feedbackSchemaFor(topic.structure, topic.mode) })
    .safeParse(body);
  return success.success ? ok(success.data.feedback) : err("unknown");
}
