"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, type ReactElement, useId } from "react";

import {
  LEVELS,
  structureForUnit,
  type Level,
  type StructureType,
  type UnitId,
} from "../../../core/drill";
import { useStateDocument } from "../../_client/use-state-document";
import { Link } from "../../../i18n/navigation";

const TOPICS_PER_PASS = 16;

const STRUCTURE_MESSAGE_KEYS = {
  prep: "structure.prep",
  concession: "structure.concession",
  comparison: "structure.comparison",
  mixed: "structure.mixed",
} as const satisfies Record<StructureType | "mixed", string>;

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
    return <p>{t("loading")}</p>;
  }

  return (
    <section>
      <p>
        <label htmlFor={levelId}>{t("levelLabel")}</label>{" "}
        <select id={levelId} value={state.level} onChange={changeLevel}>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </p>

      <ul>
        {units.map((unit) => {
          const progress = state.units[unit];
          const answered = progress?.answeredTopicIds.length ?? 0;
          const structure = structureForUnit(unit);

          return (
            <li key={unit}>
              <h2>
                <Link href={`/units/${String(unit)}`}>{t("unit", { unit })}</Link>
              </h2>
              <p>{t(STRUCTURE_MESSAGE_KEYS[structure])}</p>
              <p>{t("progress", { answered, total: TOPICS_PER_PASS })}</p>
              {progress?.completed === true ? <p>{`✓ ${t("completed")}`}</p> : null}
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
