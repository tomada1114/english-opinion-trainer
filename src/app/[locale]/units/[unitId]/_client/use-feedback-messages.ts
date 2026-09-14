import { useTranslations } from "next-intl";

import type { AnswerViolation } from "../../../../../core/answer-rules";
import {
  type FeedbackErrorCode,
  isAnswerRuleFeedbackError,
  isTerminalFeedbackError,
} from "./request-feedback";

/**
 * What the composer's two message slots should read for the current phase.
 *
 * @remarks
 * A validation violation always wins the answer slot — it is caught before
 * anything is sent, so it can never coexist with a request outcome. Among a
 * failed request's own codes: terminal replaces the composer entirely (so it
 * carries no message of its own here), the server's own verdict on a rule the
 * client already checked reads beside the answer, and everything else reads
 * beside the send button as something a resend might fix.
 */
export function useFeedbackMessages(
  failedCode: FeedbackErrorCode | undefined,
  violation: AnswerViolation | undefined,
  ceiling: number,
): {
  readonly terminalCode: FeedbackErrorCode | undefined;
  readonly answerError: string | undefined;
  readonly sendError: string | undefined;
} {
  const t = useTranslations("Drill");

  function violationMessage(broken: AnswerViolation): string {
    switch (broken) {
      case "empty":
        return t("validation.empty");
      case "too-long":
        return t("validation.tooLong", { max: ceiling });
      case "not-english":
        return t("validation.notEnglish");
    }
  }

  const terminalCode =
    failedCode !== undefined && isTerminalFeedbackError(failedCode)
      ? failedCode
      : undefined;
  const serverRuleError =
    failedCode !== undefined && isAnswerRuleFeedbackError(failedCode)
      ? t(`errors.${failedCode}`)
      : undefined;
  const sendError =
    failedCode !== undefined &&
    terminalCode === undefined &&
    serverRuleError === undefined
      ? t(`errors.${failedCode}`)
      : undefined;

  return {
    terminalCode,
    answerError:
      violation !== undefined ? violationMessage(violation) : serverRuleError,
    sendError,
  };
}
