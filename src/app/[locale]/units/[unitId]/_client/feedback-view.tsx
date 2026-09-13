import { useTranslations } from "next-intl";
import type { ReactElement, Ref } from "react";

import type { Topic } from "../../../../../core/content/index";
import { elementsFor, type Level } from "../../../../../core/drill";
import type { Feedback, Verdict } from "../../../../../core/feedback";
import { Card } from "../../../../_client/ui/card";
import { FeedbackDetails } from "./feedback-details";
import { RewritePanel } from "./rewrite-panel";
import { VerdictBadge } from "./verdict-badge";

interface ElementJudgement {
  readonly verdict: Verdict;
  readonly reason: string;
}

/**
 * The feedback for one answer: the structural verdicts and the rewrite in the
 * open, the two detail lists behind disclosures.
 *
 * @remarks
 * Two-stage rather than four sections all expanded. The structural summary and
 * the rewrite are what the reader acts on next, and they are placed together
 * deliberately — reading a comment about a missing example beside the sentence
 * that supplies one is the point of the screen, which is also why these are not
 * tabs.
 */
export function FeedbackView({
  topic,
  level,
  usedSeed,
  feedback,
  headingRef,
}: Readonly<{
  topic: Topic;
  level: Level;
  usedSeed: boolean;
  feedback: Feedback;
  /** Focused when the feedback arrives, which is how the reader is told it did. */
  headingRef: Ref<HTMLHeadingElement>;
}>): ReactElement {
  const t = useTranslations("Drill");
  const judgements: Readonly<Record<string, ElementJudgement>> = feedback.structure;

  return (
    <Card
      data-answer-level={level}
      data-used-seed={usedSeed}
      // `scroll-margin-top` keeps the heading clear of the viewport edge when
      // the focus move above scrolls it into view.
      className="scroll-mt-8 space-y-5"
    >
      <h3
        ref={headingRef}
        // Focusable only programmatically: it is a scroll and announcement
        // target, not a stop on the Tab order.
        tabIndex={-1}
        className="text-xl font-semibold text-text"
      >
        {t("feedback.heading")}
      </h3>

      <section className="space-y-2">
        <h4 className="text-lg font-semibold text-text">
          {t("feedback.structureHeading")}
        </h4>
        <ul className="space-y-2">
          {elementsFor(topic.structure, topic.mode).map((element) => {
            const judgement = judgements[element];
            return (
              <li key={element} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-medium text-text">
                    {t(`element.${element}`)}
                  </span>
                  {judgement === undefined ? null : (
                    <VerdictBadge
                      verdict={judgement.verdict}
                      label={t(`verdict.${judgement.verdict}`)}
                    />
                  )}
                </div>
                {judgement === undefined ? null : (
                  <p className="text-sm text-text-muted">{judgement.reason}</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <RewritePanel
        topic={topic}
        level={level}
        usedSeed={usedSeed}
        rewrite={feedback.rewrite}
      />

      <FeedbackDetails feedback={feedback} />
    </Card>
  );
}
