"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactElement } from "react";

import { Badge } from "../../../_client/ui/badge";
import { Button } from "../../../_client/ui/button";
import { Card } from "../../../_client/ui/card";
import type { PhraseEntry } from "../../../../core/state";

/** One step of {@link formatRelativeReviewTime}'s unit ladder, largest first. */
const RELATIVE_TIME_UNITS: readonly {
  readonly unit: Intl.RelativeTimeFormatUnit;
  readonly seconds: number;
}[] = [
  { unit: "year", seconds: 60 * 60 * 24 * 365 },
  { unit: "month", seconds: 60 * 60 * 24 * 30 },
  { unit: "week", seconds: 60 * 60 * 24 * 7 },
  { unit: "day", seconds: 60 * 60 * 24 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
];

/**
 * `lastReviewedAt` relative to `now`, as `Intl.RelativeTimeFormat` text
 * ("3 days ago") rather than a raw timestamp.
 *
 * @remarks
 * Walks {@link RELATIVE_TIME_UNITS} largest-first and stops at the first unit
 * `lastReviewedAt` is at least one whole step from `now`, falling back to
 * seconds. `now` is a parameter rather than read from `Date.now()` here so a
 * caller — a test included — can pass a fixed instant.
 */
function formatRelativeReviewTime(
  lastReviewedAt: string,
  now: Date,
  locale: string,
): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffSeconds = (Date.parse(lastReviewedAt) - now.getTime()) / 1000;
  for (const { unit, seconds } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return formatter.format(Math.round(diffSeconds), "second");
}

/**
 * One saved phrase, with the attempt it came from as tags.
 *
 * @remarks
 * The phrase itself is the user's own text, so it renders with newlines intact —
 * nothing here interprets it as markup. Delete is `destructive` and quiet until
 * hovered: it is the only irreversible action on the page, and the page's job is
 * reading rather than pruning.
 *
 * The reviewed state is marked by an explicit control, never by rendering the
 * row — scroll position is not intent — and shown as relative text rather than
 * a colour alone, so it still reads in greyscale and under forced colours.
 */
export function PhraseRow({
  phrase,
  onDelete,
  onMarkReviewed,
}: Readonly<{
  phrase: PhraseEntry;
  onDelete: () => void;
  onMarkReviewed: () => void;
}>): ReactElement {
  const t = useTranslations("Phrases");
  const locale = useLocale();

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
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-text-muted">
            {phrase.lastReviewedAt === null
              ? t("reviewed.never")
              : t("reviewed.lastReviewed", {
                  time: formatRelativeReviewTime(
                    phrase.lastReviewedAt,
                    new Date(),
                    locale,
                  ),
                })}
          </p>
          <Button variant="secondary" size="sm" onClick={onMarkReviewed}>
            {t("reviewed.markButton")}
          </Button>
        </div>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          {t("delete")}
        </Button>
      </Card>
    </li>
  );
}
