import { useTranslations } from "next-intl";
import type { ReactElement } from "react";

import { elementsFor, type Mode, type StructureType } from "../../../../../core/drill";
import type { Feedback, Verdict } from "../../../../../core/feedback";

interface ElementJudgement {
  readonly verdict: Verdict;
  readonly reason: string;
}

/** The schema-fixed feedback for one answer, one section per field. */
export function FeedbackView({
  structure,
  mode,
  feedback,
}: Readonly<{
  structure: StructureType;
  mode: Mode;
  feedback: Feedback;
}>): ReactElement {
  const t = useTranslations("Drill");
  const judgements: Readonly<Record<string, ElementJudgement>> = feedback.structure;

  return (
    <section>
      <h3>{t("feedback.heading")}</h3>

      <h4>{t("feedback.structureHeading")}</h4>
      <ul>
        {elementsFor(structure, mode).map((element) => {
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
      <p>{feedback.rewrite}</p>
      {/* A visible no-op until the phrase list exists (#18). */}
      <button type="button" disabled>
        {t("feedback.savePhrase")}
      </button>

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
