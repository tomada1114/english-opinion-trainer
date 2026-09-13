"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useState } from "react";

import {
  CATEGORIES,
  LEVELS,
  MODES,
  STRUCTURE_TYPES,
  type Category,
  type Level,
  type Mode,
  type StructureType,
} from "../../../../core/drill";
import { useStateDocument } from "../../../_client/use-state-document";
import { FilterSelect, type FilterOption } from "./filter-select";

type UsedSeedFilter = "" | "true" | "false";
interface PhraseFilters {
  readonly category: Category | "";
  readonly structure: StructureType | "";
  readonly mode: Mode | "";
  readonly level: Level | "";
  readonly usedSeed: UsedSeedFilter;
}

type FilterKey = keyof PhraseFilters;

interface FilterDefinition {
  readonly key: FilterKey;
  readonly label: string;
  readonly options: readonly FilterOption<string>[];
}

const EMPTY_FILTERS: PhraseFilters = {
  category: "",
  structure: "",
  mode: "",
  level: "",
  usedSeed: "",
};
/** The browser-only phrase list, including tag filters and single-entry removal. */
export function PhraseList(): ReactElement {
  const t = useTranslations("Phrases");
  const { state, loaded, setState } = useStateDocument();
  const [filters, setFilters] = useState<PhraseFilters>(EMPTY_FILTERS);

  if (!loaded) {
    return <p>{t("loading")}</p>;
  }

  const filterDefinitions = [
    {
      key: "category",
      label: t("category.label"),
      options: CATEGORIES.map((category) => ({
        value: category,
        label: t(`category.${category}`),
      })),
    },
    {
      key: "structure",
      label: t("structure.label"),
      options: STRUCTURE_TYPES.map((structure) => ({
        value: structure,
        label: t(`structure.${structure}`),
      })),
    },
    {
      key: "mode",
      label: t("mode.label"),
      options: MODES.map((mode) => ({
        value: mode,
        label: t(`mode.${mode}`),
      })),
    },
    {
      key: "level",
      label: t("level"),
      options: LEVELS.map((level) => ({ value: level, label: level })),
    },
    {
      key: "usedSeed",
      label: t("usedSeed.label"),
      options: [
        { value: "true", label: t("usedSeed.yes") },
        { value: "false", label: t("usedSeed.no") },
      ],
    },
  ] satisfies readonly FilterDefinition[];

  function changeFilter(key: FilterKey): (value: string) => void {
    return (value) => {
      setFilters((current) => ({ ...current, [key]: value }));
    };
  }

  const visiblePhrases = state.phrases
    .filter(
      (phrase) =>
        (filters.category === "" || phrase.category === filters.category) &&
        (filters.structure === "" || phrase.structure === filters.structure) &&
        (filters.mode === "" || phrase.mode === filters.mode) &&
        (filters.level === "" || phrase.level === filters.level) &&
        (filters.usedSeed === "" || String(phrase.usedSeed) === filters.usedSeed),
    )
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));

  function deletePhrase(id: string): void {
    setState((current) => ({
      ...current,
      phrases: current.phrases.filter((phrase) => phrase.id !== id),
    }));
  }

  return (
    <section>
      <fieldset>
        <legend>{t("filters")}</legend>
        {filterDefinitions.map((filter) => (
          <FilterSelect
            key={filter.key}
            label={filter.label}
            allLabel={t("all")}
            options={filter.options}
            value={filters[filter.key]}
            onChange={changeFilter(filter.key)}
          />
        ))}
      </fieldset>

      {visiblePhrases.length === 0 ? (
        <p>{state.phrases.length === 0 ? t("empty") : t("noMatches")}</p>
      ) : (
        <ul>
          {visiblePhrases.map((phrase) => (
            <li key={phrase.id}>
              <p>{phrase.text}</p>
              <p>
                <span>
                  {t("category.label")}: {t(`category.${phrase.category}`)}
                </span>{" "}
                <span>
                  {t("structure.label")}: {t(`structure.${phrase.structure}`)}
                </span>{" "}
                <span>
                  {t("mode.label")}: {t(`mode.${phrase.mode}`)}
                </span>{" "}
                <span>
                  {t("level")}: {phrase.level}
                </span>{" "}
                <span>
                  {t("usedSeed.label")}:{" "}
                  {t(phrase.usedSeed ? "usedSeed.yes" : "usedSeed.no")}
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  deletePhrase(phrase.id);
                }}
              >
                {t("delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
