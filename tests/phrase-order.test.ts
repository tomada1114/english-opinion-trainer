import { describe, expect, it } from "vitest";

import { comparePhrasesByOrder, DEFAULT_PHRASE_ORDER } from "../src/core/phrase-order";
import type { PhraseEntry } from "../src/core/state";

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
    lastReviewedAt: null,
    ...overrides,
  };
}

describe("DEFAULT_PHRASE_ORDER", () => {
  it("is newest, so nothing changes for a reader who liked the old behaviour", () => {
    expect(DEFAULT_PHRASE_ORDER).toBe("newest");
  });
});

describe("comparePhrasesByOrder", () => {
  it("sorts newest by savedAt descending, unchanged from before lastReviewedAt existed", () => {
    const older = makePhrase({ id: "older", savedAt: "2026-09-10T00:00:00.000Z" });
    const newer = makePhrase({ id: "newer", savedAt: "2026-09-12T00:00:00.000Z" });

    expect([older, newer].sort(comparePhrasesByOrder("newest"))).toStrictEqual([
      newer,
      older,
    ]);
  });

  it("puts every never-reviewed phrase ahead of every reviewed one under review order", () => {
    const reviewedRecently = makePhrase({
      id: "reviewed-recently",
      lastReviewedAt: "2026-09-13T00:00:00.000Z",
    });
    const neverReviewed = makePhrase({
      id: "never-reviewed",
      savedAt: "2026-09-13T00:00:00.000Z",
      lastReviewedAt: null,
    });

    expect(
      [reviewedRecently, neverReviewed].sort(comparePhrasesByOrder("review")),
    ).toStrictEqual([neverReviewed, reviewedRecently]);
  });

  it("orders reviewed phrases oldest-reviewed first under review order", () => {
    const reviewedLongAgo = makePhrase({
      id: "reviewed-long-ago",
      lastReviewedAt: "2026-09-01T00:00:00.000Z",
    });
    const reviewedRecently = makePhrase({
      id: "reviewed-recently",
      lastReviewedAt: "2026-09-13T00:00:00.000Z",
    });

    expect(
      [reviewedRecently, reviewedLongAgo].sort(comparePhrasesByOrder("review")),
    ).toStrictEqual([reviewedLongAgo, reviewedRecently]);
  });

  it("breaks a tie between two never-reviewed phrases by savedAt ascending", () => {
    const savedFirst = makePhrase({
      id: "saved-first",
      savedAt: "2026-09-01T00:00:00.000Z",
      lastReviewedAt: null,
    });
    const savedSecond = makePhrase({
      id: "saved-second",
      savedAt: "2026-09-05T00:00:00.000Z",
      lastReviewedAt: null,
    });

    expect(
      [savedSecond, savedFirst].sort(comparePhrasesByOrder("review")),
    ).toStrictEqual([savedFirst, savedSecond]);
  });

  it("breaks a tie between two phrases reviewed at the same instant by savedAt ascending", () => {
    const sameReviewTime = "2026-09-10T00:00:00.000Z";
    const savedFirst = makePhrase({
      id: "saved-first",
      savedAt: "2026-09-01T00:00:00.000Z",
      lastReviewedAt: sameReviewTime,
    });
    const savedSecond = makePhrase({
      id: "saved-second",
      savedAt: "2026-09-05T00:00:00.000Z",
      lastReviewedAt: sameReviewTime,
    });

    expect(
      [savedSecond, savedFirst].sort(comparePhrasesByOrder("review")),
    ).toStrictEqual([savedFirst, savedSecond]);
  });
});
