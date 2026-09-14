import { useTranslations } from "next-intl";
import { type ReactElement, useEffect, useRef, useState } from "react";

import {
  ANSWER_CEILING,
  type AnswerViolation,
  checkAnswer,
} from "../../../../../core/answer-rules";
import type { Topic } from "../../../../../core/content/index";
import type { Level } from "../../../../../core/drill";
import type { Feedback } from "../../../../../core/feedback";
import { Button } from "../../../../_client/ui/button";
import { SurfaceError } from "../../../../_client/ui/surface-error";
import { useStateDocument } from "../../../../_client/use-state-document";
import { AnswerComposer } from "./answer-composer";
import { FeedbackView } from "./feedback-view";
import { type FeedbackErrorCode, requestFeedback } from "./request-feedback";
import { SeedReveal } from "./seed-reveal";
import { TopicHeader } from "./topic-header";
import { useCancellableRequest } from "./use-cancellable-request";
import { useFeedbackMessages } from "./use-feedback-messages";

/** Where one attempt at a topic stands. */
type Phase =
  | { readonly kind: "writing" }
  | { readonly kind: "sending" }
  | { readonly kind: "failed"; readonly code: FeedbackErrorCode }
  | { readonly kind: "answered"; readonly feedback: Feedback };

/**
 * One topic, from a blank answer to its feedback.
 *
 * @remarks
 * An answer the shared rules refuse is reported here and never sent. A failed
 * request keeps the answer in the textarea and turns the submit button into a
 * resend, so nothing typed is lost to a transient error — except where the code
 * says no resend can succeed, which replaces the composer instead of offering a
 * button that cannot work.
 */
export function TopicAttempt({
  topic,
  level,
  onAnswered,
  onSkip,
}: Readonly<{
  topic: Topic;
  level: Level;
  onAnswered: () => void;
  onSkip: () => void;
}>): ReactElement {
  const t = useTranslations("Drill");
  const { state, setState } = useStateDocument();
  const [answer, setAnswer] = useState("");
  const [violation, setViolation] = useState<AnswerViolation | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ kind: "writing" });
  const [usedSeed, setUsedSeed] = useState(false);
  const [submittedLevel, setSubmittedLevel] = useState<Level | undefined>(undefined);
  const feedbackHeadingRef = useRef<HTMLHeadingElement>(null);
  const request = useCancellableRequest();
  const ceiling = ANSWER_CEILING[topic.mode];
  const answered = phase.kind === "answered";

  // One mechanism for three kinds of reader: the pointer user is scrolled to the
  // feedback, the keyboard user's next Tab starts from it rather than from the
  // button that has just gone, and a screen reader announces the heading. The
  // scroll honours `prefers-reduced-motion` through `tokens.css`'s
  // `scroll-behavior: auto`.
  useEffect(() => {
    if (answered) {
      feedbackHeadingRef.current?.focus();
    }
  }, [answered]);

  function flagTopic(): void {
    setState((current) =>
      current.flaggedTopicIds.includes(topic.id)
        ? current
        : { ...current, flaggedTopicIds: [...current.flaggedTopicIds, topic.id] },
    );
  }

  async function send(): Promise<void> {
    const checked = checkAnswer(answer, topic.mode);
    if (!checked.ok) {
      setViolation(checked.error);
      return;
    }
    setViolation(undefined);
    setPhase({ kind: "sending" });
    const requestLevel = submittedLevel ?? level;
    setSubmittedLevel(requestLevel);
    const signal = request.start();
    try {
      const result = await requestFeedback(topic, checked.value, requestLevel, signal);
      setPhase(
        result.ok
          ? { kind: "answered", feedback: result.value }
          : { kind: "failed", code: result.error },
      );
    } catch (error) {
      // Cancelled, by the reader or by unmounting: `cancel` below already
      // returned the phase to "writing", and an unmounted component has no
      // phase left to set — either way, nothing went wrong to report.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      throw error;
    }
  }

  /** Hangs off the Cancel control: gives up on the in-flight request. */
  function cancel(): void {
    request.cancel();
    setPhase({ kind: "writing" });
  }

  const failedCode = phase.kind === "failed" ? phase.code : undefined;
  const { terminalCode, answerError, sendError } = useFeedbackMessages(
    failedCode,
    violation,
    ceiling,
  );

  return (
    <article className="measure space-y-6">
      <TopicHeader
        topic={topic}
        flagged={state.flaggedTopicIds.includes(topic.id)}
        onFlag={flagTopic}
      />

      <SeedReveal
        topicId={topic.id}
        level={level}
        disabled={answered || phase.kind === "sending"}
        onReveal={() => {
          setUsedSeed(true);
        }}
      />

      {terminalCode === undefined ? null : (
        <SurfaceError heading={t("errors.terminalHeading")}>
          {t(`errors.${terminalCode}`)}
        </SurfaceError>
      )}
      {terminalCode !== undefined ? null : (
        <AnswerComposer
          answer={answer}
          ceiling={ceiling}
          busy={phase.kind === "sending"}
          settled={answered}
          {...(answerError === undefined ? {} : { answerError })}
          {...(sendError === undefined ? {} : { sendError })}
          canResend={phase.kind === "failed"}
          onAnswerChange={(next) => {
            setAnswer(next);
            // Clearing on the first keystroke is the point: an error that stays
            // put after the reader has fixed it teaches them to ignore it.
            setViolation(undefined);
          }}
          onSend={() => {
            void send();
          }}
          onCancel={cancel}
          onSkip={onSkip}
        />
      )}

      {phase.kind === "answered" ? (
        <div className="space-y-4 motion-safe:animate-feedback-in">
          <p role="status" className="sr-only">
            {t("feedbackReady")}
          </p>
          <FeedbackView
            topic={topic}
            level={submittedLevel ?? level}
            usedSeed={usedSeed}
            feedback={phase.feedback}
            headingRef={feedbackHeadingRef}
          />
          <Button variant="primary" onClick={onAnswered}>
            {t("next")}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
