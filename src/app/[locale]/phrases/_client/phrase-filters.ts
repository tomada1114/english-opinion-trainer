import { useTranslations } from "next-intl";

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
import type { FilterOption } from "./filter-select";

type UsedSeedFilter = "" | "true" | "false";

/** The phrase list's tag filters, each unset (`""`) meaning "no restriction". */
export interface PhraseFilters {
  readonly category: Category | "";
  readonly structure: StructureType | "";
  readonly mode: Mode | "";
  readonly level: Level | "";
  readonly usedSeed: UsedSeedFilter;
}

export type FilterKey = keyof PhraseFilters;

export interface FilterDefinition {
  readonly key: FilterKey;
  readonly label: string;
  readonly options: readonly FilterOption<string>[];
}

export const EMPTY_FILTERS: PhraseFilters = {
  category: "",
  structure: "",
  mode: "",
  level: "",
  usedSeed: "",
};

/** The five filter selects, with their translated labels and options. */
export function usePhraseFilterDefinitions(): readonly FilterDefinition[] {
  const t = useTranslations("Phrases");

  return [
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
}
