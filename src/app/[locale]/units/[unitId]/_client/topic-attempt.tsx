import { useTranslations } from "next-intl";
import { type ReactElement, type SyntheticEvent, useId, useState } from "react";

import {
  ANSWER_CEILING,
  type AnswerViolation,
  checkAnswer,
} from "../../../../../core/answer-rules";
import { getSeedsForTopic, type Topic } from "../../../../../core/content/index";
import type { Level } from "../../../../../core/drill";
import { STRUCTURE_TEMPLATES } from "../../../../../core/drill";
import type { Feedback } from "../../../../../core/feedback";
import { FeedbackView } from "./feedback-view";
import { type FeedbackErrorCode, requestFeedback } from "./request-feedback";

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
 * resend, so nothing typed is lost to a transient error.
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
  const answerId = useId();
  const countId = useId();
  const [answer, setAnswer] = useState("");
  const [violation, setViolation] = useState<AnswerViolation | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ kind: "writing" });
  const [showSeeds, setShowSeeds] = useState(false);
  const [usedSeed, setUsedSeed] = useState(false);
  const [submittedLevel, setSubmittedLevel] = useState<Level | undefined>(undefined);
  const ceiling = ANSWER_CEILING[topic.mode];

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
    const result = await requestFeedback(topic, checked.value, requestLevel);
    setPhase(
      result.ok
        ? { kind: "answered", feedback: result.value }
        : { kind: "failed", code: result.error },
    );
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void send();
  }

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

  const answered = phase.kind === "answered";
  const sending = phase.kind === "sending";

  return (
    <article>
      <h2>{topic.text}</h2>
      <p>
        {t("structureLabel")}: {STRUCTURE_TEMPLATES[topic.structure]}
      </p>
      <p>{t(`mode.${topic.mode}`)}</p>

      <p>
        <button
          type="button"
          disabled={answered || sending}
          onClick={() => {
            setShowSeeds(true);
            setUsedSeed(true);
          }}
        >
          {t("showSeeds")}
        </button>
      </p>
      {showSeeds ? (
        <section>
          <h3>{t("seeds.heading")}</h3>
          <ul>
            {getSeedsForTopic(topic.id, level).map((seed, index) => (
              <li key={`${seed.topicId}-${seed.level}-${String(index)}`}>
                <p>
                  <strong>{t("seeds.stance")}:</strong> {seed.stance}
                </p>
                <p>
                  <strong>{t("seeds.keyPhrases")}:</strong>
                </p>
                <ul>
                  {seed.keyPhrases.map((phrase) => (
                    <li key={phrase}>{phrase}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form onSubmit={handleSubmit}>
        <label htmlFor={answerId}>{t("answerLabel")}</label>
        <textarea
          id={answerId}
          value={answer}
          rows={topic.mode === "short" ? 3 : 8}
          readOnly={answered || sending}
          aria-invalid={violation !== undefined}
          aria-describedby={countId}
          onChange={(event) => {
            setAnswer(event.target.value);
          }}
        />
        <p id={countId}>
          {t("characterCount", { count: answer.trim().length, max: ceiling })}
        </p>
        {violation === undefined ? null : (
          <p role="alert">{violationMessage(violation)}</p>
        )}
        {phase.kind === "failed" ? (
          <p role="alert">{t(`errors.${phase.code}`)}</p>
        ) : null}

        {answered ? null : (
          <p>
            <button type="submit" disabled={sending}>
              {sending
                ? t("sending")
                : phase.kind === "failed"
                  ? t("resend")
                  : t("send")}
            </button>{" "}
            <button type="button" disabled={sending} onClick={onSkip}>
              {t("skip")}
            </button>
          </p>
        )}
      </form>

      {answered ? (
        <>
          <FeedbackView
            structure={topic.structure}
            mode={topic.mode}
            level={submittedLevel ?? level}
            usedSeed={usedSeed}
            feedback={phase.feedback}
          />
          <p>
            <button type="button" onClick={onAnswered}>
              {t("next")}
            </button>
          </p>
        </>
      ) : null}
    </article>
  );
}
