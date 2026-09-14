import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ANSWERED_BY_DAY_HISTORY_DAYS,
  defaultState,
  localDayKey,
  migrateState,
  recordAnsweredDay,
  type PhraseEntry,
  type StateDocument,
} from "../src/core/state";

// Written out by hand from the shape .agents/skills/building-the-drill/SKILL.md
// fixes, so the assertions below do not pass by construction.
const DEFAULT_DOCUMENT = {
  version: 1,
  level: "B1",
  units: {},
  phrases: [],
  flaggedTopicIds: [],
  flaggedSeedIds: [],
  answeredByDay: {},
  dailyTarget: 3,
} as const;

function makePhrase(overrides: Partial<PhraseEntry> = {}): PhraseEntry {
  return {
    id: "phrase-1",
    text: "I would recommend Kyoto because it is quiet in winter.",
    topicId: "prep-travel-short",
    category: "travel",
    structure: "prep",
    mode: "short",
    level: "B1",
    usedSeed: false,
    savedAt: "2026-09-11T00:00:00.000Z",
    ...overrides,
  };
}

function makeDocument(): StateDocument {
  return {
    version: 1,
    level: "B2",
    units: {
      1: {
        answeredTopicIds: ["prep-travel-short", "prep-food-short"],
        completed: false,
      },
      4: { answeredTopicIds: [], completed: true },
    },
    phrases: [
      makePhrase(),
      makePhrase({ id: "phrase-2", usedSeed: true, mode: "long" }),
    ],
    flaggedTopicIds: ["concession-work-long"],
    flaggedSeedIds: ["seed-17"],
    answeredByDay: { "2026-09-10": 2, "2026-09-13": 1 },
    dailyTarget: 5,
  };
}

describe("defaultState", () => {
  it("is version 1 at level B1 with nothing recorded", () => {
    expect(defaultState()).toStrictEqual(DEFAULT_DOCUMENT);
  });

  it("returns a fresh document each call, so mutating one cannot leak", () => {
    const first = defaultState();
    first.flaggedTopicIds.push("prep-travel-short");

    expect(defaultState().flaggedTopicIds).toStrictEqual([]);
  });

  it("types the version as the literal 1, not a wider number", () => {
    expectTypeOf(defaultState().version).toEqualTypeOf<1>();
  });
});

describe("migrateState", () => {
  it("returns a valid version 1 document unchanged", () => {
    expect(migrateState(makeDocument())).toStrictEqual(makeDocument());
  });

  it("round-trips a document through JSON, the way storage holds it", () => {
    const stored: unknown = JSON.parse(JSON.stringify(makeDocument()));

    expect(migrateState(stored)).toStrictEqual(makeDocument());
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty object", {}],
    ["a string", "english-opinion-trainer"],
    ["a number", 1],
    ["an array", [makeDocument()]],
  ])("resets %s to the default document", (_label, raw) => {
    expect(migrateState(raw)).toStrictEqual(DEFAULT_DOCUMENT);
  });

  it.each([
    ["no version", { version: undefined }],
    ["version 0", { version: 0 }],
    ["version 2, which this build has no migration for", { version: 2 }],
    ['version "1" as a string', { version: "1" }],
    ["a level outside A2/B1/B2", { level: "C1" }],
    [
      "a unit id outside 1-4",
      { units: { 5: { answeredTopicIds: [], completed: false } } },
    ],
    ["a unit missing its completed flag", { units: { 1: { answeredTopicIds: [] } } }],
    [
      "a non-string answered topic id",
      { units: { 2: { answeredTopicIds: [7], completed: false } } },
    ],
    [
      "a phrase with an unknown category",
      { phrases: [{ ...makePhrase(), category: "sports" }] },
    ],
    [
      "a phrase without savedAt",
      { phrases: [{ ...makePhrase(), savedAt: undefined }] },
    ],
    ["flagged ids that are not an array", { flaggedSeedIds: "seed-17" }],
    [
      "an answeredByDay count that is not a number",
      { answeredByDay: { "2026-09-13": "2" } },
    ],
    ["a dailyTarget that is not a number", { dailyTarget: "3" }],
    ["a dailyTarget of zero", { dailyTarget: 0 }],
  ])("resets a document with %s to the default", (_label, override) => {
    expect(migrateState({ ...makeDocument(), ...override })).toStrictEqual(
      DEFAULT_DOCUMENT,
    );
  });

  it("gives an absent answeredByDay an empty object and an absent dailyTarget its default, keeping the rest", () => {
    const document = makeDocument();
    const withoutNewFields = {
      version: document.version,
      level: document.level,
      units: document.units,
      phrases: document.phrases,
      flaggedTopicIds: document.flaggedTopicIds,
      flaggedSeedIds: document.flaggedSeedIds,
    };

    expect(migrateState(withoutNewFields)).toStrictEqual({
      ...document,
      answeredByDay: {},
      dailyTarget: 3,
    });
  });

  it("drops a top-level key the schema does not name, keeping the rest", () => {
    expect(migrateState({ ...makeDocument(), streak: 3 })).toStrictEqual(
      makeDocument(),
    );
  });
});

describe("localDayKey", () => {
  it("formats the local year, month and day as YYYY-MM-DD", () => {
    expect(localDayKey(new Date(2026, 8, 14))).toBe("2026-09-14");
  });

  it("zero-pads a single-digit month and day", () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("reads the date's local calendar, not its UTC one", () => {
    // 23:40 local time on 2026-09-14, deliberately close to midnight so a
    // UTC-based implementation would roll it to the 15th (or the 13th, west
    // of UTC) instead of keeping the reader's own day.
    expect(localDayKey(new Date(2026, 8, 14, 23, 40))).toBe("2026-09-14");
  });
});

describe("recordAnsweredDay", () => {
  it("starts a day at 1 and does not mutate the input", () => {
    const answeredByDay = Object.freeze({ "2026-09-13": 2 });

    const next = recordAnsweredDay(answeredByDay, "2026-09-14");

    expect(next).toStrictEqual({ "2026-09-13": 2, "2026-09-14": 1 });
    expect(answeredByDay).toStrictEqual({ "2026-09-13": 2 });
  });

  it("increments today's key and leaves other days alone", () => {
    const answeredByDay = { "2026-09-12": 3, "2026-09-13": 1 };

    const next = recordAnsweredDay(answeredByDay, "2026-09-13");

    expect(next).toStrictEqual({ "2026-09-12": 3, "2026-09-13": 2 });
  });

  it("drops entries older than the retention window, keeping the most recent days", () => {
    const answeredByDay: Record<string, number> = {};
    // One entry per day for one more day than the retention window holds.
    for (let i = 0; i < ANSWERED_BY_DAY_HISTORY_DAYS + 1; i += 1) {
      const day = new Date(2026, 0, 1 + i);
      answeredByDay[localDayKey(day)] = 1;
    }
    const oldestDay = localDayKey(new Date(2026, 0, 1));
    const todayKey = localDayKey(new Date(2026, 0, ANSWERED_BY_DAY_HISTORY_DAYS + 2));

    const next = recordAnsweredDay(answeredByDay, todayKey);

    expect(Object.keys(next)).toHaveLength(ANSWERED_BY_DAY_HISTORY_DAYS);
    expect(next[oldestDay]).toBeUndefined();
    expect(next[todayKey]).toBe(1);
  });
});
