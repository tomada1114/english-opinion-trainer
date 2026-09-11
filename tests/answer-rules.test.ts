import { describe, expect, it } from "vitest";

import { ANSWER_CEILING, checkAnswer } from "../src/core/answer-rules";

// The ceilings are restated as literals rather than read back from
// ANSWER_CEILING, so a changed number fails here instead of moving the
// expectation along with it.
const SHORT_CEILING = 400;
const LONG_CEILING = 1_200;

describe("ANSWER_CEILING", () => {
  it("allows 400 characters for a short answer and 1200 for a long one", () => {
    expect(ANSWER_CEILING).toStrictEqual({ short: SHORT_CEILING, long: LONG_CEILING });
  });
});

describe("checkAnswer", () => {
  it("returns the answer trimmed when it passes every rule", () => {
    expect(checkAnswer("  I recommend Kyoto.\n", "short")).toStrictEqual({
      ok: true,
      value: "I recommend Kyoto.",
    });
  });

  it.each([
    ["an empty answer", ""],
    ["a whitespace-only answer", " \n\t "],
  ])("refuses %s as empty", (_label, answer) => {
    expect(checkAnswer(answer, "short")).toStrictEqual({ ok: false, error: "empty" });
  });

  it.each([
    ["a short answer at its ceiling", "short", "a".repeat(SHORT_CEILING)],
    ["a long answer at its ceiling", "long", "a".repeat(LONG_CEILING)],
    [
      "an answer at the ceiling once trimmed",
      "short",
      `  ${"a".repeat(SHORT_CEILING)}\n`,
    ],
    ["a long-mode length on a long topic", "long", "a".repeat(SHORT_CEILING + 1)],
  ] as const)("accepts %s", (_label, mode, answer) => {
    expect(checkAnswer(answer, mode).ok).toBe(true);
  });

  it.each([
    ["a Japanese answer", "私は京都をおすすめします。"],
    ["a katakana-only answer", "テスト"],
    [
      "an answer whose kana and kanji outnumber its Latin letters",
      "私はKyotoが好きです",
    ],
  ])("refuses %s as not English", (_label, answer) => {
    expect(checkAnswer(answer, "short")).toStrictEqual({
      ok: false,
      error: "not-english",
    });
  });

  it.each([
    [
      "an English answer quoting a Japanese word",
      "I recommend Kyoto, or 京都, to everyone.",
    ],
    ["an answer with as many CJK characters as Latin letters", "abc 日本語"],
    ["an English answer with accented letters", "I recommend a café in Kyoto."],
  ])("accepts %s", (_label, answer) => {
    expect(checkAnswer(answer, "short").ok).toBe(true);
  });

  it("checks the length before the language", () => {
    expect(checkAnswer("日".repeat(SHORT_CEILING + 1), "short")).toStrictEqual({
      ok: false,
      error: "too-long",
    });
  });
});
