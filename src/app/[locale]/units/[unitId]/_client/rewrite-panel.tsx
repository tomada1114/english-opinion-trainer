import { useTranslations } from "next-intl";
import { type ReactElement, useId, useState } from "react";

import type { Topic } from "../../../../../core/content/index";
import type { Level } from "../../../../../core/drill";
import { Button } from "../../../../_client/ui/button";
import { Label } from "../../../../_client/ui/label";
import { Textarea } from "../../../../_client/ui/textarea";
import { useStateDocument } from "../../../../_client/use-state-document";

/**
 * The model's full replacement answer, editable, and the one action that keeps it.
 *
 * @remarks
 * Editable before saving on purpose: the rewrite is a proposal, and the phrase
 * the reader wants to keep is often a trimmed version of it. Saving records the
 * attempt it came from — topic, category, structure, mode, level, and whether a
 * seed was used — because those are the axes the phrase list filters on.
 */
export function RewritePanel({
  topic,
  level,
  usedSeed,
  rewrite: initialRewrite,
}: Readonly<{
  topic: Topic;
  level: Level;
  usedSeed: boolean;
  rewrite: string;
}>): ReactElement {
  const t = useTranslations("Drill");
  const rewriteId = useId();
  const { setState } = useStateDocument();
  const [rewrite, setRewrite] = useState(initialRewrite);
  const [saved, setSaved] = useState(false);
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
    <section className="space-y-2">
      <h4 className="text-lg font-semibold text-text">
        {t("feedback.rewriteHeading")}
      </h4>
      <Label htmlFor={rewriteId}>{t("feedback.editRewriteLabel")}</Label>
      <Textarea
        id={rewriteId}
        value={rewrite}
        rows={3}
        onChange={(event) => {
          setRewrite(event.target.value);
          setSaved(false);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" disabled={!canSave} onClick={savePhrase}>
          {t("feedback.savePhrase")}
        </Button>
        {saved ? (
          <p role="status" className="flex items-center gap-2 text-sm text-success">
            {t("feedback.savedToPhrases")}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSaved(false);
              }}
            >
              {t("feedback.dismissSaved")}
            </Button>
          </p>
        ) : null}
      </div>
    </section>
  );
}
