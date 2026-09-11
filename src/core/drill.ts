/**
 * The drill's domain vocabulary: the closed sets every zone above `src/core/`
 * is written in, and the pure mappings between them.
 *
 * @remarks
 * Each set is an `as const` tuple with its literal union derived from it, so
 * the runtime list and the type cannot drift apart. These strings are internal
 * identifiers, not UI copy — a label a user reads comes from the message
 * catalogs.
 */

/** The answer shapes a topic can ask for. */
export const STRUCTURE_TYPES = ["prep", "concession", "comparison"] as const;

/** One of {@link STRUCTURE_TYPES}. */
export type StructureType = (typeof STRUCTURE_TYPES)[number];

/** Answer lengths: `short` is 1–2 sentences, `long` is 4–6. */
export const MODES = ["short", "long"] as const;

/** One of {@link MODES}. */
export type Mode = (typeof MODES)[number];

/** CEFR levels; a level changes the rewrite's vocabulary and strictness only. */
export const LEVELS = ["A2", "B1", "B2"] as const;

/** One of {@link LEVELS}. */
export type Level = (typeof LEVELS)[number];

/** The level a learner starts at before choosing one. */
export const DEFAULT_LEVEL: Level = "B1";

/** The drill's units, each drawing from one structure's topics or from all. */
export const UNIT_IDS = [1, 2, 3, 4] as const;

/** One of {@link UNIT_IDS}. */
export type UnitId = (typeof UNIT_IDS)[number];

/**
 * The unit a URL segment names, or `undefined` when it names none.
 *
 * @remarks
 * Only the canonical spelling matches — `"1"`, not `"01"`, `"1.0"` or `" 1"` —
 * so each unit has exactly one URL.
 */
export function parseUnitId(segment: string): UnitId | undefined {
  return UNIT_IDS.find((unit) => String(unit) === segment);
}

/**
 * The structure a unit's topics use, or `"mixed"` for the unit that draws from
 * every structure.
 */
export function structureForUnit(unit: UnitId): StructureType | "mixed" {
  switch (unit) {
    case 1:
      return "prep";
    case 2:
      return "concession";
    case 3:
      return "comparison";
    case 4:
      return "mixed";
  }
}

/** The topic categories; the topic grid holds every structure × category. */
export const CATEGORIES = [
  "travel",
  "food",
  "work",
  "hobbies",
  "technology",
  "city-life",
  "relationships",
  "learning",
] as const;

/** One of {@link CATEGORIES}. */
export type Category = (typeof CATEGORIES)[number];

/**
 * The elements of each structure, in the order the drill presents them.
 *
 * @remarks
 * The order is load-bearing: `short` mode judges only the first two, which is
 * why the `satisfies` clause demands at least two per structure.
 */
export const STRUCTURE_ELEMENTS = {
  prep: ["point", "reason", "example", "restatement"],
  concession: ["acknowledgement", "opinion", "reason"],
  comparison: ["contrast", "choice", "reason"],
} as const satisfies Record<StructureType, readonly [string, string, ...string[]]>;

/** An element key of structure `S`, or of any structure when `S` is left wide. */
export type ElementKey<S extends StructureType = StructureType> =
  (typeof STRUCTURE_ELEMENTS)[S][number];

type FirstTwo<T> = T extends readonly [infer A, infer B, ...unknown[]]
  ? readonly [A, B]
  : never;

/** The element keys {@link elementsFor} returns for structure `S` in mode `M`. */
export type ElementsFor<S extends StructureType, M extends Mode> = M extends "short"
  ? FirstTwo<(typeof STRUCTURE_ELEMENTS)[S]>
  : (typeof STRUCTURE_ELEMENTS)[S];

const SHORT_MODE_ELEMENT_COUNT = 2;

/**
 * The element keys judged for an answer in `structure` and `mode`: the first
 * two for `short`, all of them for `long`.
 *
 * @remarks
 * The return type follows the arguments, so a literal call such as
 * `elementsFor("prep", "short")` is typed `readonly ["point", "reason"]`. The
 * array is a fresh copy; mutating it cannot change the vocabulary.
 */
export function elementsFor<S extends StructureType, M extends Mode>(
  structure: S,
  mode: M,
): ElementsFor<S, M>;
// TypeScript cannot evaluate a conditional type over unresolved generics, so
// the narrowed signature above is an overload; tests/drill.test.ts pins every
// structure × mode against it.
export function elementsFor(
  structure: StructureType,
  mode: Mode,
): readonly ElementKey[] {
  const elements: readonly ElementKey[] = STRUCTURE_ELEMENTS[structure];
  const count = mode === "short" ? SHORT_MODE_ELEMENT_COUNT : elements.length;
  return elements.slice(0, count);
}

/** The question shapes a topic can be written in. */
export const QUESTION_TYPES = [
  "recommendation",
  "opinion",
  "agree-disagree",
  "either-or",
] as const;

/** One of {@link QUESTION_TYPES}. */
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * The structure each question type is answered in.
 *
 * @remarks
 * The app assigns a topic's structure from its fixed question type; the user
 * never chooses one.
 */
export const QUESTION_TYPE_TO_STRUCTURE = {
  recommendation: "prep",
  opinion: "prep",
  "agree-disagree": "concession",
  "either-or": "comparison",
} as const satisfies Record<QuestionType, StructureType>;

/**
 * A one-line English explanation of each structure's shape, shown beside a
 * topic so the user knows how to answer it. Never translated.
 */
export const STRUCTURE_TEMPLATES: Readonly<Record<StructureType, string>> = {
  prep: "Point → Reason → Example → Point (restated)",
  concession: "Acknowledge the other side → Give your opinion → Give a reason",
  comparison: "Contrast the two options → Make your choice → Give a reason",
};
