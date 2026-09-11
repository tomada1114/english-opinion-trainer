import { useTranslations } from "next-intl";
import { type ReactElement, useId, useState } from "react";

import type { Topic } from "../../../../../core/content/index";
import { elementsFor, type Level } from "../../../../../core/drill";
import type { Feedback, Verdict } from "../../../../../core/feedback";
import { useStateDocument } from "../../../../_client/use-state-document";

interface ElementJudgement {
  readonly verdict: Verdict;
  readonly reason: string;
}

/** The schema-fixed feedback for one answer, one section per field. */
export function FeedbackView({
  topic,
  level,
  usedSeed,
  feedback,
}: Readonly<{
  topic: Topic;
  level: Level;
  usedSeed: boolean;
  feedback: Feedback;
}>): ReactElement {
  const t = useTranslations("Drill");
  const rewriteId = useId();
  const { setState } = useStateDocument();
  const [rewrite, setRewrite] = useState(feedback.rewrite);
  const [saved, setSaved] = useState(false);
  const judgements: Readonly<Record<string, ElementJudgement>> = feedback.structure;
  const canSave = rewrite.trim().length > 0;

  function savePhrase(): void {
    if (!canSave) {
      return;
    }
    setState((current) => ({
      ...current,
      phrases: [
        ...current.phrases,
        {
          id: crypto.randomUUID(),
          text: rewrite.trim(),
          topicId: topic.id,
          category: topic.category,
          structure: topic.structure,
          mode: topic.mode,
          level,
          usedSeed,
          savedAt: new Date().toISOString(),
        },
      ],
    }));
    setSaved(true);
  }

  return (
    <section data-answer-level={level} data-used-seed={usedSeed}>
      <h3>{t("feedback.heading")}</h3>

      <h4>{t("feedback.structureHeading")}</h4>
      <ul>
        {elementsFor(topic.structure, topic.mode).map((element) => {
          const judgement = judgements[element];
          return (
            <li key={element}>
              <strong>{t(`element.${element}`)}</strong>
              {judgement === undefined ? null : (
                <>
                  : {t(`verdict.${judgement.verdict}`)} — {judgement.reason}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <h4>{t("feedback.fixesHeading")}</h4>
      {feedback.fixes.length === 0 ? (
        <p>{t("feedback.noFixes")}</p>
      ) : (
        <ul>
          {feedback.fixes.map((fix, index) => (
            // The model's own order is the only identity a fix or a note has.
            <li key={index}>
              <del>{fix.before}</del> → <ins>{fix.after}</ins> — {fix.why}
            </li>
          ))}
        </ul>
      )}

      <h4>{t("feedback.rewriteHeading")}</h4>
      <label htmlFor={rewriteId}>{t("feedback.editRewriteLabel")}</label>
      <textarea
        id={rewriteId}
        value={rewrite}
        rows={4}
        onChange={(event) => {
          setRewrite(event.target.value);
          setSaved(false);
        }}
      />
      <button type="button" disabled={!canSave} onClick={savePhrase}>
        {t("feedback.savePhrase")}
      </button>
      {saved ? (
        <p role="status">
          {t("feedback.savedToPhrases")}{" "}
          <button
            type="button"
            onClick={() => {
              setSaved(false);
            }}
          >
            {t("feedback.dismissSaved")}
          </button>
        </p>
      ) : null}

      <h4>{t("feedback.grammarHeading")}</h4>
      {feedback.grammar.length === 0 ? (
        <p>{t("feedback.noGrammar")}</p>
      ) : (
        <ul>
          {feedback.grammar.map((note, index) => (
            <li key={index}>
              <del>{note.excerpt}</del> → <ins>{note.correction}</ins> — {note.note}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
