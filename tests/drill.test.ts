import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CATEGORIES,
  type Category,
  DEFAULT_LEVEL,
  type ElementKey,
  elementsFor,
  type Level,
  LEVELS,
  type Mode,
  MODES,
  parseUnitId,
  QUESTION_TYPE_TO_STRUCTURE,
  type QuestionType,
  QUESTION_TYPES,
  STRUCTURE_TEMPLATES,
  STRUCTURE_TYPES,
  structureForUnit,
  type StructureType,
  UNIT_IDS,
  type UnitId,
} from "../src/core/drill";

// Mirrors tests/skills-frontmatter.test.ts: CJK is the script a translated
// string would most plausibly slip in with.
const CJK = /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/u;

describe("the closed sets", () => {
  it.each([
    ["STRUCTURE_TYPES", STRUCTURE_TYPES, ["prep", "concession", "comparison"]],
    ["MODES", MODES, ["short", "long"]],
    ["LEVELS", LEVELS, ["A2", "B1", "B2"]],
    ["UNIT_IDS", UNIT_IDS, [1, 2, 3, 4]],
    [
      "CATEGORIES",
      CATEGORIES,
      [
        "travel",
        "food",
        "work",
        "hobbies",
        "technology",
        "city-life",
        "relationships",
        "learning",
      ],
    ],
    [
      "QUESTION_TYPES",
      QUESTION_TYPES,
      ["recommendation", "opinion", "agree-disagree", "either-or"],
    ],
  ] as const)(
    "%s lists exactly its settled members, without duplicates",
    (_, actual, expected) => {
      expect(actual).toStrictEqual(expected);
      expect(new Set<unknown>(actual).size).toBe(actual.length);
    },
  );

  it("derives each type as exactly the literal union of its list", () => {
    expectTypeOf<StructureType>().toEqualTypeOf<"prep" | "concession" | "comparison">();
    expectTypeOf<Mode>().toEqualTypeOf<"short" | "long">();
    expectTypeOf<Level>().toEqualTypeOf<"A2" | "B1" | "B2">();
    expectTypeOf<UnitId>().toEqualTypeOf<1 | 2 | 3 | 4>();
    expectTypeOf<Category>().toEqualTypeOf<
      | "travel"
      | "food"
      | "work"
      | "hobbies"
      | "technology"
      | "city-life"
      | "relationships"
      | "learning"
    >();
    expectTypeOf<QuestionType>().toEqualTypeOf<
      "recommendation" | "opinion" | "agree-disagree" | "either-or"
    >();
  });

  it("defaults the level to B1", () => {
    expect(DEFAULT_LEVEL).toBe("B1");
  });
});

describe("structureForUnit", () => {
  it.each([
    [1, "prep"],
    [2, "concession"],
    [3, "comparison"],
    [4, "mixed"],
  ] as const)("maps unit %i to %s", (unit, expected) => {
    expect(structureForUnit(unit)).toBe(expected);
  });

  it("rejects a unit id outside UNIT_IDS at compile time", () => {
    const rejected = (): unknown =>
      // @ts-expect-error 5 is not a UnitId
      structureForUnit(5);
    expectTypeOf(structureForUnit(4)).toEqualTypeOf<StructureType | "mixed">();
    expect(rejected).toBeTypeOf("function");
  });
});

describe("parseUnitId", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["4", 4],
  ] as const)("reads %p as unit %i", (segment, expected) => {
    expect(parseUnitId(segment)).toBe(expected);
  });

  it.each(["0", "5", "-1", "01", "1.0", " 1", "1 ", "", "one", "NaN"])(
    "reads %p as no unit",
    (segment) => {
      expect(parseUnitId(segment)).toBeUndefined();
    },
  );

  it("is typed to return a UnitId or undefined", () => {
    expectTypeOf(parseUnitId).returns.toEqualTypeOf<UnitId | undefined>();
  });
});

describe("elementsFor", () => {
  it.each([
    ["prep", "short", ["point", "reason"]],
    ["prep", "long", ["point", "reason", "example", "restatement"]],
    ["concession", "short", ["acknowledgement", "opinion"]],
    ["concession", "long", ["acknowledgement", "opinion", "reason"]],
    ["comparison", "short", ["contrast", "choice"]],
    ["comparison", "long", ["contrast", "choice", "reason"]],
  ] as const)("judges %s in %s mode by %j", (structure, mode, expected) => {
    expect(elementsFor(structure, mode)).toStrictEqual(expected);
  });

  it.each(STRUCTURE_TYPES)(
    "judges a prefix of %s's long elements in short mode",
    (structure) => {
      const long = elementsFor(structure, "long");

      expect(elementsFor(structure, "short")).toStrictEqual(long.slice(0, 2));
    },
  );

  it("returns a copy, so mutating it leaves the vocabulary unchanged", () => {
    const first = elementsFor("prep", "long") as unknown as string[];
    first.length = 0;

    expect(elementsFor("prep", "long")).toStrictEqual([
      "point",
      "reason",
      "example",
      "restatement",
    ]);
  });

  it("narrows its return type to the judged keys for each literal mode", () => {
    expectTypeOf(elementsFor("prep", "short")).toEqualTypeOf<
      readonly ["point", "reason"]
    >();
    expectTypeOf(elementsFor("prep", "long")).toEqualTypeOf<
      readonly ["point", "reason", "example", "restatement"]
    >();
    expectTypeOf(elementsFor("concession", "short")).toEqualTypeOf<
      readonly ["acknowledgement", "opinion"]
    >();
    expectTypeOf(elementsFor("comparison", "long")).toEqualTypeOf<
      readonly ["contrast", "choice", "reason"]
    >();
  });

  it("stays a list of element keys when the arguments are only known by their unions", () => {
    function judged(structure: StructureType, mode: Mode): readonly ElementKey[] {
      return elementsFor(structure, mode);
    }

    expectTypeOf<ElementKey>().toEqualTypeOf<
      | "point"
      | "reason"
      | "example"
      | "restatement"
      | "acknowledgement"
      | "opinion"
      | "contrast"
      | "choice"
    >();
    expectTypeOf<ElementKey<"comparison">>().toEqualTypeOf<
      "contrast" | "choice" | "reason"
    >();
    expect(judged("concession", "long")).toStrictEqual([
      "acknowledgement",
      "opinion",
      "reason",
    ]);
  });

  it("rejects a mode outside MODES at compile time", () => {
    const rejected = (): unknown =>
      // @ts-expect-error "medium" is not a Mode
      elementsFor("prep", "medium");
    expectTypeOf(elementsFor("prep", "short")).toEqualTypeOf<
      readonly ["point", "reason"]
    >();
    expect(rejected).toBeTypeOf("function");
  });
});

describe("QUESTION_TYPE_TO_STRUCTURE", () => {
  it.each([
    ["recommendation", "prep"],
    ["opinion", "prep"],
    ["agree-disagree", "concession"],
    ["either-or", "comparison"],
  ] as const)("answers a %s question in %s", (questionType, structure) => {
    expect(QUESTION_TYPE_TO_STRUCTURE[questionType]).toBe(structure);
  });

  it("covers every question type and reaches every structure", () => {
    expect(Object.keys(QUESTION_TYPE_TO_STRUCTURE).sort()).toStrictEqual(
      ["agree-disagree", "either-or", "opinion", "recommendation"].sort(),
    );
    expect(new Set(Object.values(QUESTION_TYPE_TO_STRUCTURE))).toStrictEqual(
      new Set(["prep", "concession", "comparison"]),
    );
  });
});

describe("STRUCTURE_TEMPLATES", () => {
  it("has exactly one entry per structure type", () => {
    expect(Object.keys(STRUCTURE_TEMPLATES).sort()).toStrictEqual(
      ["comparison", "concession", "prep"].sort(),
    );
  });

  it.each(STRUCTURE_TYPES)("explains %s in non-empty English prose", (structure) => {
    const template = STRUCTURE_TEMPLATES[structure];

    expect(template.trim()).not.toBe("");
    expect(template).toMatch(/[A-Za-z]/u);
    expect(template).not.toMatch(CJK);
  });

  it("explains prep as point, reason, example, then the point restated", () => {
    expect(STRUCTURE_TEMPLATES.prep).toBe(
      "Point → Reason → Example → Point (restated)",
    );
  });
});
