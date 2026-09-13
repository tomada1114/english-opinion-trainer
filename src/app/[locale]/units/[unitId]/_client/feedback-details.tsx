import { useTranslations } from "next-intl";
import type { ReactElement } from "react";

import type { Feedback } from "../../../../../core/feedback";
import { Disclosure } from "../../../../_client/ui/disclosure";
import { DiffLine } from "./diff-line";

/**
 * The two lists that are collapsed by default: what to fix, and the grammar notes.
 *
 * @remarks
 * Collapsed rather than always open because a long answer can come back with
 * five of each, and that much at once on a phone is read by nobody. The count
 * badge is what makes the closed state honest — it says how much is inside
 * without the reader having to open it to find out.
 *
 * Neither list carries a severity in the feedback schema, so neither gets a
 * status colour; the `before → after` shape is the whole signal.
 */
export function FeedbackDetails({
  feedback,
}: Readonly<{ feedback: Feedback }>): ReactElement {
  const t = useTranslations("Drill");

  return (
    <div className="space-y-2">
      <Disclosure summary={t("feedback.fixesHeading")} count={feedback.fixes.length}>
        {feedback.fixes.length === 0 ? (
          <p className="text-sm text-text-muted">{t("feedback.noFixes")}</p>
        ) : (
          <ul>
            {feedback.fixes.map((fix, index) => (
              // The model's own order is the only identity a fix or a note has.
              <DiffLine
                key={index}
                before={fix.before}
                after={fix.after}
                why={fix.why}
              />
            ))}
          </ul>
        )}
      </Disclosure>

      <Disclosure
        summary={t("feedback.grammarHeading")}
        count={feedback.grammar.length}
      >
        {feedback.grammar.length === 0 ? (
          <p className="text-sm text-text-muted">{t("feedback.noGrammar")}</p>
        ) : (
          <ul>
            {feedback.grammar.map((note, index) => (
              <DiffLine
                key={index}
                before={note.excerpt}
                after={note.correction}
                why={note.note}
              />
            ))}
          </ul>
        )}
      </Disclosure>
    </div>
  );
}
