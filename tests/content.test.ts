import { describe, expect, expectTypeOf, it } from "vitest";

import seedsJson from "../src/core/content/seeds.json";
import {
  getSeedsForTopic,
  getTopicById,
  getTopics,
  getTopicsForUnit,
  type Seed,
  seedSchema,
  seedsSchema,
  type Topic,
  topicSchema,
  topicsSchema,
} from "../src/core/content/index";
import {
  CATEGORIES,
  type Category,
  type Level,
  LEVELS,
  type Mode,
  MODES,
  STRUCTURE_TYPES,
  type StructureType,
  UNIT_IDS,
} from "../src/core/drill";

// Mirrors tests/drill.test.ts: CJK is the script a translated string would
// most plausibly slip in with, and static data is never translated.
const CJK = /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/u;

function makeTopic(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "prep-travel-short",
    category: "travel",
    structure: "prep",
    mode: "short",
    text: "What is one place you would recommend to a friend?",
    ...overrides,
  };
}

function makeSeed(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    topicId: "prep-travel-short",
    level: "B1",
    stance: "Kyoto, for its temples",
    keyPhrases: ["steeped in history"],
    ...overrides,
  };
}

// Every assertion reads the dataset's own size, or derives it from the
// closed vocabularies, so the same suite holds for the placeholders shipped
// before #13 and the full grid that replaces them.
describe("the topics dataset", () => {
  const topics = getTopics();

  it("is not empty", () => {
    expect(topics.length).toBeGreaterThan(0);
  });

  it("fills the whole structure × category × mode grid, exactly once per cell", () => {
    expect(topics.length).toBe(
      STRUCTURE_TYPES.length * CATEGORIES.length * MODES.length,
    );
  });

  it("gives every topic a unique id", () => {
    expect(new Set(topics.map((topic) => topic.id)).size).toBe(topics.length);
  });

  it("gives every topic a unique text", () => {
    expect(new Set(topics.map((topic) => topic.text)).size).toBe(topics.length);
  });

  it("holds at most one short and one long topic per structure × category cell", () => {
    const cells = new Map<string, number>();
    for (const topic of topics) {
      const cell = `${topic.structure}/${topic.category}/${topic.mode}`;
      cells.set(cell, (cells.get(cell) ?? 0) + 1);
    }

    expect([...cells].filter(([, count]) => count > 1)).toStrictEqual([]);
  });

  it.each(
    STRUCTURE_TYPES.flatMap((structure) =>
      MODES.map((mode) => [structure, mode] as const),
    ),
  )("has a %s topic in %s mode", (structure, mode) => {
    expect(
      topics.some((topic) => topic.structure === structure && topic.mode === mode),
    ).toBe(true);
  });

  it.each(
    STRUCTURE_TYPES.flatMap((structure) =>
      CATEGORIES.flatMap((category) =>
        MODES.map((mode) => [structure, category, mode] as const),
      ),
    ),
  )("has exactly one %s/%s topic in %s mode", (structure, category, mode) => {
    expect(
      topics.filter(
        (topic) =>
          topic.structure === structure &&
          topic.category === category &&
          topic.mode === mode,
      ),
    ).toHaveLength(1);
  });

  it("gives every topic's id the <structure>-<category>-<mode> shape", () => {
    for (const topic of topics) {
      expect(topic.id).toBe(`${topic.structure}-${topic.category}-${topic.mode}`);
    }
  });

  it("writes every topic as exactly one question, at most 20 words", () => {
    for (const topic of topics) {
      expect(topic.text.match(/\?/gu)).toHaveLength(1);
      expect(topic.text.trim().endsWith("?")).toBe(true);
      expect(topic.text.trim().split(/\s+/u).length).toBeLessThanOrEqual(20);
    }
  });

  it("writes every topic in English, with no CJK", () => {
    expect(topics.filter((topic) => CJK.test(topic.text))).toStrictEqual([]);
  });

  it("is frozen, so a caller cannot reorder or replace it", () => {
    expect(Object.isFrozen(topics)).toBe(true);
  });
});

describe("getTopicById", () => {
  it("returns the row whose id it is given, for every topic", () => {
    for (const topic of getTopics()) {
      expect(getTopicById(topic.id)).toBe(topic);
    }
  });

  it("returns the prep/travel/short topic by its literal id", () => {
    expect(getTopicById("prep-travel-short")).toStrictEqual({
      id: "prep-travel-short",
      category: "travel",
      structure: "prep",
      mode: "short",
      text: "What is one place you would recommend to a friend visiting your country?",
    });
  });

  it.each(["no-such-topic", "", "PREP-TRAVEL-SHORT", " prep-travel-short"])(
    "returns undefined for %p, an id no topic has",
    (id) => {
      expect(getTopicById(id)).toBeUndefined();
    },
  );

  it("is typed to return a Topic or undefined", () => {
    expectTypeOf(getTopicById).returns.toEqualTypeOf<Topic | undefined>();
  });
});

describe("getTopicsForUnit", () => {
  it.each([
    [1, "prep"],
    [2, "concession"],
    [3, "comparison"],
  ] as const)("gives unit %i exactly the %s topics", (unit, structure) => {
    expect(getTopicsForUnit(unit)).toStrictEqual(
      getTopics().filter((topic) => topic.structure === structure),
    );
  });

  it("gives unit 4, the mixed unit, every topic", () => {
    expect(getTopicsForUnit(4)).toStrictEqual(getTopics());
  });

  it.each(UNIT_IDS)("gives unit %i at least one short and one long topic", (unit) => {
    const modes = new Set(getTopicsForUnit(unit).map((topic) => topic.mode));

    expect([...modes].sort()).toStrictEqual(["long", "short"]);
  });

  it("gives unit 1 the placeholder travel topic by its literal id", () => {
    expect(getTopicsForUnit(1).map((topic) => topic.id)).toContain("prep-travel-short");
    expect(getTopicsForUnit(2).map((topic) => topic.id)).not.toContain(
      "prep-travel-short",
    );
  });
});

// The 48 topics × 3 levels × 3 seeds grid from #14. Every assertion reads the
// dataset's own size, or derives it from the topic grid and the closed level
// vocabulary, the same way the topics describe block above does.
describe("the seeds dataset", () => {
  const seeds = seedsSchema.parse(seedsJson);
  const topics = getTopics();

  it("has exactly one triple of 3 seeds per topic × level pair", () => {
    expect(seeds.length).toBe(topics.length * LEVELS.length * 3);
  });

  it("covers every (topicId, level) pair from the topic × level grid exactly once, with exactly 3 rows", () => {
    const counts = new Map<string, number>();
    for (const seed of seeds) {
      const key = `${seed.topicId}/${seed.level}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    for (const topic of topics) {
      for (const level of LEVELS) {
        expect(counts.get(`${topic.id}/${level}`)).toBe(3);
      }
    }
    expect(counts.size).toBe(topics.length * LEVELS.length);
  });

  it("gives every (topicId, level) triple 3 distinct stance values", () => {
    const stancesByTriple = new Map<string, Set<string>>();
    for (const seed of seeds) {
      const key = `${seed.topicId}/${seed.level}`;
      const stances = stancesByTriple.get(key) ?? new Set<string>();
      stances.add(seed.stance);
      stancesByTriple.set(key, stances);
    }

    expect([...stancesByTriple.values()].every((stances) => stances.size === 3)).toBe(
      true,
    );
  });

  it("writes every keyPhrases entry with no terminal punctuation and at most 12 words", () => {
    for (const seed of seeds) {
      for (const phrase of seed.keyPhrases) {
        expect(/[.!?]$/u.test(phrase.trim())).toBe(false);
        expect(phrase.trim().split(/\s+/u).length).toBeLessThanOrEqual(12);
      }
    }
  });

  it("writes every stance and keyPhrases entry in English, with no CJK", () => {
    for (const seed of seeds) {
      expect(CJK.test(seed.stance)).toBe(false);
      expect(seed.keyPhrases.some((phrase) => CJK.test(phrase))).toBe(false);
    }
  });

  it("names a topicId that exists in topics.json, for every seed", () => {
    const topicIds = new Set(topics.map((topic) => topic.id));
    expect(seeds.every((seed) => topicIds.has(seed.topicId))).toBe(true);
  });
});

describe("getSeedsForTopic", () => {
  it.each(LEVELS)(
    "returns exactly 3 seeds for a known topic at %s, each naming that topic and level",
    (level) => {
      const seeds = getSeedsForTopic("prep-travel-short", level);
      expect(seeds).toHaveLength(3);
      for (const seed of seeds) {
        expect(seed.topicId).toBe("prep-travel-short");
        expect(seed.level).toBe(level);
      }
    },
  );

  it("returns no seeds for an unknown topic", () => {
    expect(getSeedsForTopic("no-such-topic", "B1")).toStrictEqual([]);
  });
});

describe("topicSchema", () => {
  it("accepts a well-formed topic", () => {
    expect(topicSchema.parse(makeTopic())).toStrictEqual(makeTopic());
  });

  it.each([
    ["category", CATEGORIES, topicSchema.shape.category.options],
    ["structure", STRUCTURE_TYPES, topicSchema.shape.structure.options],
    ["mode", MODES, topicSchema.shape.mode.options],
  ] as const)(
    "validates %s against exactly the drill vocabulary",
    (_, list, options) => {
      expect(options).toStrictEqual(list);
    },
  );

  it.each([
    ["a category outside CATEGORIES", { category: "sports" }],
    ["a structure outside STRUCTURE_TYPES", { structure: "narrative" }],
    ["a mode outside MODES", { mode: "medium" }],
    ["an empty id", { id: "" }],
    ["an empty text", { text: "" }],
    ["a missing text", { text: undefined }],
    ["a key the schema does not declare", { level: "B1" }],
  ])("rejects %s", (_, overrides) => {
    expect(topicSchema.safeParse(makeTopic(overrides)).success).toBe(false);
  });

  it("rejects a topics file that is not an array", () => {
    expect(topicsSchema.safeParse(makeTopic()).success).toBe(false);
  });

  it("infers Topic from the schema, with the drill's unions for its closed fields", () => {
    expectTypeOf<Topic>().toEqualTypeOf<{
      id: string;
      category: Category;
      structure: StructureType;
      mode: Mode;
      text: string;
    }>();
  });
});

describe("seedSchema", () => {
  it("accepts a well-formed seed", () => {
    expect(seedSchema.parse(makeSeed())).toStrictEqual(makeSeed());
  });

  it("validates level against exactly LEVELS", () => {
    expect(seedSchema.shape.level.options).toStrictEqual(LEVELS);
  });

  it("accepts two key phrases", () => {
    const seed = makeSeed({
      keyPhrases: ["steeped in history", "off the beaten path"],
    });

    expect(seedSchema.safeParse(seed).success).toBe(true);
  });

  it.each([
    ["a level outside LEVELS", { level: "C1" }],
    ["no key phrases", { keyPhrases: [] }],
    ["three key phrases", { keyPhrases: ["one", "two", "three"] }],
    ["an empty key phrase", { keyPhrases: [""] }],
    ["an empty stance", { stance: "" }],
    ["an empty topicId", { topicId: "" }],
    ["a key the schema does not declare", { text: "A full sentence." }],
  ])("rejects %s", (_, overrides) => {
    expect(seedSchema.safeParse(makeSeed(overrides)).success).toBe(false);
  });

  it("parses a seeds file as a list of seeds", () => {
    expect(seedsSchema.parse([makeSeed()])).toStrictEqual([makeSeed()]);
  });

  it("infers Seed from the schema, with Level for its level", () => {
    expectTypeOf<Seed>().toEqualTypeOf<{
      topicId: string;
      level: Level;
      stance: string;
      keyPhrases: string[];
    }>();
  });
});
