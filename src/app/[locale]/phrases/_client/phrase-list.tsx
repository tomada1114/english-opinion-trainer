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
import { Button } from "../../../_client/ui/button";
import { EmptyState } from "../../../_client/ui/empty-state";
import { Separator } from "../../../_client/ui/separator";
import { useStateDocument } from "../../../_client/use-state-document";
import { Link } from "../../../../i18n/navigation";
import { FlaggedIdList } from "./flagged-id-list";
import { FilterSelect, type FilterOption } from "./filter-select";
import { PhraseRow } from "./phrase-row";
import { StateIo } from "./state-io";

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
    return <p className="text-text-muted">{t("loading")}</p>;
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
  const nothingSavedYet = state.phrases.length === 0;
  return (
    <section className="measure space-y-6">
      <StateIo state={state} onImport={setState} />
      <Separator />
      {/* Hidden entirely while there is nothing to filter: five selects above an
          onboarding message would suggest the list is filtered rather than empty. */}
      {nothingSavedYet ? null : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-text">{t("filters")}</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
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
          </div>
        </fieldset>
      )}
      {/* Two distinct states, deliberately not one shared message: "you have not
          saved anything" and "your filters excluded everything" lead the reader to
          different next actions, and a single line would strand whoever is in the
          case it was not written for. */}
      {visiblePhrases.length === 0 ? (
        nothingSavedYet ? (
          <EmptyState
            variant="onboarding"
            heading={t("empty.heading")}
            body={t("empty.body")}
            action={
              <Button asChild variant="primary">
                <Link href="/">{t("empty.action")}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            variant="filtered-out"
            heading={t("noMatches.heading")}
            body={t("noMatches.body")}
            action={
              <Button
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                }}
              >
                {t("clearFilters")}
              </Button>
            }
          />
        )
      ) : (
        <ul className="space-y-3">
          {visiblePhrases.map((phrase) => (
            <PhraseRow
              key={phrase.id}
              phrase={phrase}
              onDelete={deletePhrase.bind(null, phrase.id)}
            />
          ))}
        </ul>
      )}
      <Separator />
      <FlaggedIdList state={state} />
    </section>
  );
}
