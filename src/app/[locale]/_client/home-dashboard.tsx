"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, type ReactElement, useId } from "react";

import {
  LEVELS,
  STRUCTURE_TEMPLATES,
  structureForUnit,
  type Level,
  type UnitId,
} from "../../../core/drill";
import { localDayKey } from "../../../core/state";
import { TOPICS_PER_PASS } from "../../../core/unit-progress";
import { Badge } from "../../_client/ui/badge";
import { Card } from "../../_client/ui/card";
import { Label } from "../../_client/ui/label";
import { Select } from "../../_client/ui/select";
import { useStateDocument } from "../../_client/use-state-document";
import { Link } from "../../../i18n/navigation";

function isLevel(value: string): value is Level {
  return LEVELS.some((level) => level === value);
}

/** The interactive home-page content backed by the browser state document. */
export function HomeDashboard({
  units,
}: Readonly<{ units: readonly UnitId[] }>): ReactElement {
  const t = useTranslations("HomePage");
  const levelId = useId();
  const { state, loaded, setState } = useStateDocument();

  function changeLevel(event: ChangeEvent<HTMLSelectElement>): void {
    const nextLevel = event.currentTarget.value;
    if (!isLevel(nextLevel)) {
      return;
    }
    setState((current) => ({ ...current, level: nextLevel }));
  }

  if (!loaded) {
    // Deliberately not a zeroed dashboard: rendering every unit at 0 answered
    // while the state document is still resolving would read as lost progress.
    return <p className="text-text-muted">{t("loading")}</p>;
  }

  const answeredToday = state.answeredByDay[localDayKey(new Date())] ?? 0;
  const targetMet = answeredToday >= state.dailyTarget;

  return (
    <section className="measure space-y-6">
      <div className="space-y-1">
        <Label htmlFor={levelId}>{t("levelLabel")}</Label>
        <Select id={levelId} value={state.level} onChange={changeLevel}>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm tabular-nums text-text-subtle">
          {t("today.progress", { answered: answeredToday, target: state.dailyTarget })}
        </p>
        {targetMet ? (
          // A glyph and a word, the same shape the unit completion badge uses.
          <Badge tone="success">
            <Check aria-hidden="true" className="size-3.5 shrink-0" />
            {t("today.done")}
          </Badge>
        ) : null}
      </div>

      <ul className="space-y-3">
        {units.map((unit) => {
          const progress = state.units[unit];
          const answered = progress?.answeredTopicIds.length ?? 0;
          const structure = structureForUnit(unit);

          return (
            <li key={unit}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold">
                    <Link href={`/units/${String(unit)}`}>{t("unit", { unit })}</Link>
                  </h2>
                  {progress?.completed === true ? (
                    // A glyph and a word, never the colour alone.
                    <Badge tone="success">
                      <Check aria-hidden="true" className="size-3.5 shrink-0" />
                      {t("completed")}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-text-muted">
                  {structure === "mixed"
                    ? t("structure.mixed")
                    : STRUCTURE_TEMPLATES[structure]}
                </p>
                <p className="text-sm tabular-nums text-text-subtle">
                  {t("progress", { answered, total: TOPICS_PER_PASS })}
                </p>
              </Card>
            </li>
          );
        })}
      </ul>

      <p>
        <Link href="/phrases">{t("phrasesLink")}</Link>
      </p>
    </section>
  );
}
