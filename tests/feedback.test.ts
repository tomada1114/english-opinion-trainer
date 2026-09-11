import { describe, expect, expectTypeOf, it } from "vitest";
import * as z from "zod";

import { elementsFor, type Mode, type StructureType } from "../src/core/drill";
import {
  type Feedback,
  feedbackSchemaFor,
  type Verdict,
  VERDICTS,
} from "../src/core/feedback";

// Written by hand, not read from STRUCTURE_ELEMENTS, so a change to the
// vocabulary has to be made here too before the schema's keys may follow it.
const SHAPES = [
  ["prep", "short", ["point", "reason"]],
  ["prep", "long", ["point", "reason", "example", "restatement"]],
  ["concession", "short", ["acknowledgement", "opinion"]],
  ["concession", "long", ["acknowledgement", "opinion", "reason"]],
  ["comparison", "short", ["contrast", "choice"]],
  ["comparison", "long", ["contrast", "choice", "reason"]],
] as const satisfies readonly (readonly [StructureType, Mode, readonly string[]])[];

function makeFeedback(
  keys: readonly string[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    structure: Object.fromEntries(
      keys.map((key) => [key, { verdict: "present", reason: "It is stated." }]),
    ),
    fixes: [],
    rewrite: "",
    grammar: [],
    ...overrides,
  };
}

describe("feedbackSchemaFor", () => {
  it("covers every structure × mode pair exactly once", () => {
    expect(
      SHAPES.map(([structure, mode]) => `${structure}/${mode}`).sort(),
    ).toStrictEqual([
      "comparison/long",
      "comparison/short",
      "concession/long",
      "concession/short",
      "prep/long",
      "prep/short",
    ]);
  });

  describe.each(SHAPES)("for %s in %s mode", (structure, mode, keys) => {
    const schema = feedbackSchemaFor(structure, mode);

    it("judges exactly the elements elementsFor returns, in order", () => {
      expect(Object.keys(schema.shape.structure.shape)).toStrictEqual(keys);
      expect(elementsFor(structure, mode)).toStrictEqual(keys);
    });

    it("carries structure, fixes, rewrite and grammar, and no score", () => {
      expect(Object.keys(schema.shape)).toStrictEqual([
        "structure",
        "fixes",
        "rewrite",
        "grammar",
      ]);
    });

    it("accepts a minimal valid answer", () => {
      const input = makeFeedback(keys);
      expect(schema.safeParse(input)).toStrictEqual({ success: true, data: input });
    });

    it.each(keys)("rejects an answer missing the %s element", (missing) => {
      const input = makeFeedback(keys.filter((key) => key !== missing));
      expect(schema.safeParse(input).success).toBe(false);
    });

    it("rejects an unrecognized top-level key rather than stripping it", () => {
      expect(schema.safeParse(makeFeedback(keys, { score: 5 })).success).toBe(false);
    });

    it("rejects an element key this structure and mode do not judge", () => {
      expect(schema.safeParse(makeFeedback([...keys, "restatement2"])).success).toBe(
        false,
      );
    });
  });

  it("rejects an element another mode would judge", () => {
    const schema = feedbackSchemaFor("prep", "short");
    const input = makeFeedback(["point", "reason", "example"]);
    expect(schema.safeParse(input).success).toBe(false);
  });

  it("rejects a missing common field", () => {
    const schema = feedbackSchemaFor("prep", "short");
    const input = makeFeedback(["point", "reason"]);
    delete input["rewrite"];
    expect(schema.safeParse(input).success).toBe(false);
  });
});

describe("an element's verdict", () => {
  const schema = feedbackSchemaFor("comparison", "short");
  const withVerdict = (verdict: unknown): unknown =>
    makeFeedback(["contrast", "choice"], {
      structure: {
        contrast: { verdict, reason: "Both options are named." },
        choice: { verdict: "present", reason: "A choice is made." },
      },
    });

  it("lists exactly present, weak and absent", () => {
    expect(VERDICTS).toStrictEqual(["present", "weak", "absent"]);
    expectTypeOf<Verdict>().toEqualTypeOf<"present" | "weak" | "absent">();
  });

  it.each(["present", "weak", "absent"])("accepts %s", (verdict) => {
    expect(schema.safeParse(withVerdict(verdict)).success).toBe(true);
  });

  it.each(["strong", "Present", "", "missing"])("rejects %p", (verdict) => {
    expect(schema.safeParse(withVerdict(verdict)).success).toBe(false);
  });

  it("rejects a judgement carrying an unrecognized key", () => {
    const input = makeFeedback(["contrast", "choice"], {
      structure: {
        contrast: { verdict: "weak", reason: "Only one option is named.", score: 1 },
        choice: { verdict: "present", reason: "A choice is made." },
      },
    });
    expect(schema.safeParse(input).success).toBe(false);
  });
});

describe("fixes and grammar", () => {
  const schema = feedbackSchemaFor("concession", "long");
  const keys = ["acknowledgement", "opinion", "reason"];

  it("accepts entries of any count, including none", () => {
    const fix = { before: "I think so.", after: "I agree.", why: "More direct." };
    const note = {
      excerpt: "a informations",
      correction: "information",
      note: "Uncountable.",
    };
    for (const [fixes, grammar] of [
      [[], []],
      [
        [fix, fix, fix],
        [note, note, note, note, note, note],
      ],
    ]) {
      expect(schema.safeParse(makeFeedback(keys, { fixes, grammar })).success).toBe(
        true,
      );
    }
  });

  it.each([
    ["a fix missing why", { fixes: [{ before: "a", after: "b" }] }],
    [
      "a fix with an extra key",
      { fixes: [{ before: "a", after: "b", why: "c", rank: 1 }] },
    ],
    ["a grammar note missing note", { grammar: [{ excerpt: "a", correction: "b" }] }],
    ["a rewrite that is not a string", { rewrite: 1 }],
  ])("rejects %s", (_, overrides) => {
    expect(schema.safeParse(makeFeedback(keys, overrides)).success).toBe(false);
  });
});

describe("the wire schema", () => {
  const LENGTH_OR_COUNT_KEYWORDS = [
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
  ];

  function walk(node: unknown, visit: (object: Record<string, unknown>) => void): void {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit);
    } else if (typeof node === "object" && node !== null) {
      const object = node as Record<string, unknown>;
      visit(object);
      for (const value of Object.values(object)) walk(value, visit);
    }
  }

  it.each(SHAPES)(
    "for %s/%s closes and requires every object",
    (structure, mode, keys) => {
      let objects = 0;
      walk(z.toJSONSchema(feedbackSchemaFor(structure, mode)), (node) => {
        if (node["type"] === "object") {
          objects += 1;
          expect(node["additionalProperties"]).toBe(false);
          expect(node["required"]).toStrictEqual(
            Object.keys(node["properties"] as object),
          );
        }
      });
      // The root, structure, one judgement per element, a fix, a grammar note.
      expect(objects).toBe(keys.length + 4);
    },
  );

  it.each(SHAPES)("for %s/%s bounds no length or count", (structure, mode) => {
    const found: string[] = [];
    walk(z.toJSONSchema(feedbackSchemaFor(structure, mode)), (node) => {
      found.push(
        ...Object.keys(node).filter((key) => LENGTH_OR_COUNT_KEYWORDS.includes(key)),
      );
    });
    expect(found).toStrictEqual([]);
  });
});

describe("the types", () => {
  interface Judgement {
    verdict: "present" | "weak" | "absent";
    reason: string;
  }
  it("types a literal call with exactly that shape's keys", () => {
    const prepShort = feedbackSchemaFor("prep", "short").parse(
      makeFeedback(["point", "reason"]),
    );
    expectTypeOf(prepShort).toEqualTypeOf<{
      structure: { point: Judgement; reason: Judgement };
      fixes: { before: string; after: string; why: string }[];
      rewrite: string;
      grammar: { excerpt: string; correction: string; note: string }[];
    }>();

    const concessionLong = feedbackSchemaFor("concession", "long").parse(
      makeFeedback(["acknowledgement", "opinion", "reason"]),
    );
    expectTypeOf(concessionLong.structure).toEqualTypeOf<{
      acknowledgement: Judgement;
      opinion: Judgement;
      reason: Judgement;
    }>();
  });

  it("widens Feedback to the union of the six shapes, with no score", () => {
    expectTypeOf<keyof Feedback>().toEqualTypeOf<
      "structure" | "fixes" | "rewrite" | "grammar"
    >();
    expectTypeOf<Feedback["structure"]>().toEqualTypeOf<
      | { point: Judgement; reason: Judgement }
      | {
          point: Judgement;
          reason: Judgement;
          example: Judgement;
          restatement: Judgement;
        }
      | { acknowledgement: Judgement; opinion: Judgement }
      | { acknowledgement: Judgement; opinion: Judgement; reason: Judgement }
      | { contrast: Judgement; choice: Judgement }
      | { contrast: Judgement; choice: Judgement; reason: Judgement }
    >();
  });

  it("rejects a structure or mode outside the vocabulary", () => {
    const rejected = (): unknown =>
      // @ts-expect-error "debate" is not a StructureType
      feedbackSchemaFor("debate", "short");
    expect(rejected).toBeTypeOf("function");
  });
});
