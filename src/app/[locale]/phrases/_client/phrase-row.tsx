"use client";

import { useTranslations } from "next-intl";
import type { ReactElement } from "react";

import { Badge } from "../../../_client/ui/badge";
import { Button } from "../../../_client/ui/button";
import { Card } from "../../../_client/ui/card";
import type { PhraseEntry } from "../../../../core/state";

/**
 * One saved phrase, with the attempt it came from as tags.
 *
 * @remarks
 * The phrase itself is the user's own text, so it renders with newlines intact —
 * nothing here interprets it as markup. Delete is `destructive` and quiet until
 * hovered: it is the only irreversible action on the page, and the page's job is
 * reading rather than pruning.
 */
export function PhraseRow({
  phrase,
  onDelete,
}: Readonly<{ phrase: PhraseEntry; onDelete: () => void }>): ReactElement {
  const t = useTranslations("Phrases");

  return (
    <li>
      <Card className="space-y-3">
        <p data-plain-text className="text-base text-text">
          {phrase.text}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {[
            t(`category.${phrase.category}`),
            t(`structure.${phrase.structure}`),
            t(`mode.${phrase.mode}`),
            phrase.level,
            t(phrase.usedSeed ? "usedSeed.yes" : "usedSeed.no"),
          ].map((tag) => (
            <li key={tag}>
              <Badge>{tag}</Badge>
            </li>
          ))}
        </ul>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          {t("delete")}
        </Button>
      </Card>
    </li>
  );
}
