import { describe, expect, expectTypeOf, it } from "vitest";

import {
  defaultState,
  migrateState,
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
  ])("resets a document with %s to the default", (_label, override) => {
    expect(migrateState({ ...makeDocument(), ...override })).toStrictEqual(
      DEFAULT_DOCUMENT,
    );
  });

  it("drops a top-level key the schema does not name, keeping the rest", () => {
    expect(migrateState({ ...makeDocument(), streak: 3 })).toStrictEqual(
      makeDocument(),
    );
  });
});
