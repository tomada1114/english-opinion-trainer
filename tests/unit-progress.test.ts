import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  MODES,
  type StructureType,
  STRUCTURE_TYPES,
} from "../src/core/drill";
import type { Topic } from "../src/core/content/index";
import {
  isCompleted,
  nextTopic,
  recordAnswered,
  recordSkipped,
  type UnitProgressState,
} from "../src/core/unit-progress";

// Independent of the module under test: the vocabulary table in
// .agents/skills/building-the-drill/SKILL.md fixes a pass at 8 short + 8 long
// topics, 16 total. Recomputing this from the implementation's own internal
// cap would make the assertions below pass by construction.
const TOPICS_PER_HALF = 8;
const TOPICS_PER_PASS = TOPICS_PER_HALF * 2;

const EMPTY_STATE: UnitProgressState = { answeredTopicIds: [], skippedTopicIds: [] };

/** A small, fast, deterministic PRNG so a test seed reproduces its draws. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSingleStructurePool(structure: StructureType): Topic[] {
  return CATEGORIES.flatMap((category) =>
    MODES.map((mode) => ({
      id: `${structure}-${category}-${mode}`,
      category,
      structure,
      mode,
      text: `${structure} ${category} ${mode} topic`,
    })),
  );
}

/** All 48 topics: 3 structures x 8 categories x 2 modes, unit 4's pool. */
function makeFullPool(): Topic[] {
  return STRUCTURE_TYPES.flatMap((structure) => makeSingleStructurePool(structure));
}

interface Draw {
  readonly topic: Topic;
  readonly action: "answered" | "skipped";
}

/**
 * Drives `nextTopic` to completion, feeding each draw to `decideSkip` to
 * choose whether it is answered or skipped. `decideSkip` must eventually
 * answer every topic it skips, or the pass never completes.
 */
function runPass(
  pool: readonly Topic[],
  rng: () => number,
  decideSkip: (topic: Topic) => boolean,
): { draws: Draw[]; finalState: UnitProgressState } {
  const draws: Draw[] = [];
  let state = EMPTY_STATE;
  let topic = nextTopic(1, pool, state, rng);

  while (topic !== undefined) {
    if (decideSkip(topic)) {
      state = recordSkipped(state, topic.id);
      draws.push({ topic, action: "skipped" });
    } else {
      state = recordAnswered(state, topic.id);
      draws.push({ topic, action: "answered" });
    }
    topic = nextTopic(1, pool, state, rng);
  }

  return { draws, finalState: state };
}

/** Skips a topic at most once (via `skipRng`), then always answers it. */
function skipOnceThenAnswer(
  skipRng: () => number,
  skipChance: number,
): (topic: Topic) => boolean {
  const alreadySkipped = new Set<string>();
  return (topic: Topic): boolean => {
    if (alreadySkipped.has(topic.id)) {
      return false;
    }
    if (skipRng() < skipChance) {
      alreadySkipped.add(topic.id);
      return true;
    }
    return false;
  };
}

/**
 * An `rng` that fails the test if called — for asserting that the
 * pending-skip requeue stage draws deterministically from the queue's own
 * order, with no randomness involved.
 */
function neverCalledRng(): number {
  throw new Error("rng should not be called once every half has been fully offered");
}

/**
 * Asserts that, within one half's ordered list of draws, no topic id repeats
 * until every id offered in that half has appeared at least once.
 */
function assertNoRepeatBeforeFullyOffered(halfDraws: readonly Topic[]): void {
  const seen = new Set<string>();
  let halfFullyOffered = false;

  for (const topic of halfDraws) {
    if (seen.has(topic.id)) {
      expect(halfFullyOffered).toBe(true);
    } else {
      seen.add(topic.id);
      if (seen.size >= TOPICS_PER_HALF) {
        halfFullyOffered = true;
      }
    }
  }
}

describe("nextTopic", () => {
  it("draws all 8 short topics, each once, before any long topic", () => {
    const pool = makeSingleStructurePool("prep");
    const rng = mulberry32(1);
    const { draws, finalState } = runPass(pool, rng, () => false);

    expect(draws).toHaveLength(TOPICS_PER_PASS);
    expect(draws.slice(0, TOPICS_PER_HALF).every((d) => d.topic.mode === "short")).toBe(
      true,
    );
    expect(draws.slice(TOPICS_PER_HALF).every((d) => d.topic.mode === "long")).toBe(
      true,
    );
    expect(new Set(draws.map((d) => d.topic.id)).size).toBe(TOPICS_PER_PASS);
    expect(isCompleted(finalState)).toBe(true);
  });

  it("returns undefined once the pass is complete", () => {
    const pool = makeSingleStructurePool("prep");
    const rng = mulberry32(2);
    const { finalState } = runPass(pool, rng, () => false);

    expect(nextTopic(1, pool, finalState, rng)).toBeUndefined();
  });

  it("never offers a topic already recorded as answered", () => {
    const pool = makeSingleStructurePool("concession");
    const rng = mulberry32(3);
    const answeredSoFar = new Set<string>();
    const { draws } = runPass(pool, rng, skipOnceThenAnswer(mulberry32(30), 0.4));

    for (const { topic, action } of draws) {
      expect(answeredSoFar.has(topic.id)).toBe(false);
      if (action === "answered") {
        answeredSoFar.add(topic.id);
      }
    }
  });

  it("re-offers a skipped topic before the pass ends, and completes at 16 answered", () => {
    const pool = makeSingleStructurePool("comparison");
    const rng = mulberry32(4);
    const { draws, finalState } = runPass(
      pool,
      rng,
      skipOnceThenAnswer(mulberry32(40), 0.5),
    );

    const skippedIds = draws
      .filter((d) => d.action === "skipped")
      .map((d) => d.topic.id);
    expect(skippedIds.length).toBeGreaterThan(0);
    for (const id of skippedIds) {
      const occurrences = draws.filter((d) => d.topic.id === id);
      expect(occurrences).toHaveLength(2);
      expect(occurrences[1]?.action).toBe("answered");
    }
    expect(finalState.answeredTopicIds).toHaveLength(TOPICS_PER_PASS);
    expect(finalState.skippedTopicIds).toStrictEqual([]);
    expect(isCompleted(finalState)).toBe(true);
  });

  it("draws the first long topic once the other 7 short topics are offered, even with one short skip pending", () => {
    const pool = makeSingleStructurePool("prep");
    const rng = mulberry32(5);
    let state = EMPTY_STATE;
    let skippedShortId: string | undefined;

    for (let i = 0; i < TOPICS_PER_HALF; i += 1) {
      const topic = nextTopic(1, pool, state, rng);
      if (topic === undefined) {
        throw new Error("expected a topic for every short-half draw");
      }
      expect(topic.mode).toBe("short");
      if (i === 0) {
        skippedShortId = topic.id;
        state = recordSkipped(state, topic.id);
      } else {
        state = recordAnswered(state, topic.id);
      }
    }

    expect(state.skippedTopicIds).toStrictEqual([skippedShortId]);

    const next = nextTopic(1, pool, state, rng);
    expect(next?.mode).toBe("long");
  });

  it("lets a repeatedly-skipped short topic reach 15 answered without blocking the long half, then resolves it last", () => {
    const pool = makeSingleStructurePool("concession");
    const rng = mulberry32(12);
    let state = EMPTY_STATE;
    let targetId: string | undefined;
    let sawLongWhileTargetPending = false;
    let reachedFifteenWhileTargetPending = false;

    let topic = nextTopic(1, pool, state, rng);
    while (topic !== undefined) {
      targetId ??= topic.id;

      if (
        topic.id === targetId &&
        state.answeredTopicIds.length < TOPICS_PER_PASS - 1
      ) {
        state = recordSkipped(state, topic.id);
      } else {
        state = recordAnswered(state, topic.id);
      }

      if (topic.mode === "long" && state.skippedTopicIds.includes(targetId)) {
        sawLongWhileTargetPending = true;
      }
      if (
        state.answeredTopicIds.length === TOPICS_PER_PASS - 1 &&
        state.skippedTopicIds.includes(targetId)
      ) {
        reachedFifteenWhileTargetPending = true;
      }

      topic = nextTopic(1, pool, state, rng);
    }

    expect(sawLongWhileTargetPending).toBe(true);
    expect(reachedFifteenWhileTargetPending).toBe(true);
    expect(state.answeredTopicIds).toHaveLength(TOPICS_PER_PASS);
    expect(state.answeredTopicIds.at(-1)).toBe(targetId);
  });

  it("re-offers a skip recorded during the short half before one recorded during the long half", () => {
    const pool = makeSingleStructurePool("prep");
    const rng = mulberry32(14);
    let state = EMPTY_STATE;
    let skippedShortId: string | undefined;
    let skippedLongId: string | undefined;

    let topic = nextTopic(1, pool, state, rng);
    while (topic !== undefined) {
      if (topic.mode === "short" && skippedShortId === undefined) {
        skippedShortId = topic.id;
        state = recordSkipped(state, topic.id);
      } else if (topic.mode === "long" && skippedLongId === undefined) {
        skippedLongId = topic.id;
        state = recordSkipped(state, topic.id);
      } else {
        state = recordAnswered(state, topic.id);
      }
      topic = nextTopic(1, pool, state, rng);
    }

    if (skippedShortId === undefined || skippedLongId === undefined) {
      throw new Error("expected both a short and a long topic to be skipped once");
    }

    const shortResolvedIndex = state.answeredTopicIds.indexOf(skippedShortId);
    const longResolvedIndex = state.answeredTopicIds.indexOf(skippedLongId);
    expect(shortResolvedIndex).toBeGreaterThan(-1);
    expect(longResolvedIndex).toBeGreaterThan(-1);
    expect(shortResolvedIndex).toBeLessThan(longResolvedIndex);
  });

  describe("the pending-skip requeue", () => {
    it("offers the long skip next once the only pending short skip is skipped again", () => {
      const pool = makeSingleStructurePool("prep");
      const shorts = pool.filter((topic) => topic.mode === "short");
      const longs = pool.filter((topic) => topic.mode === "long");
      const [pendingShort, ...answeredShorts] = shorts;
      const [pendingLong, ...answeredLongs] = longs;
      if (pendingShort === undefined || pendingLong === undefined) {
        throw new Error("expected at least one short and one long topic");
      }

      const state: UnitProgressState = {
        answeredTopicIds: [...answeredShorts, ...answeredLongs].map((t) => t.id),
        // Short recorded before long, as it would be from real play: the
        // short half is always fully offered before the long half begins.
        skippedTopicIds: [pendingShort.id, pendingLong.id],
      };

      expect(nextTopic(1, pool, state, neverCalledRng)?.id).toBe(pendingShort.id);

      const afterReskip = recordSkipped(state, pendingShort.id);

      expect(afterReskip).not.toBe(state);
      expect(afterReskip.skippedTopicIds).toStrictEqual([
        pendingLong.id,
        pendingShort.id,
      ]);
      expect(nextTopic(1, pool, afterReskip, neverCalledRng)?.id).toBe(pendingLong.id);
    });

    it("offers a re-skipped topic again only after every other pending topic has been", () => {
      const pool = makeSingleStructurePool("prep");
      const shorts = pool.filter((topic) => topic.mode === "short");
      const longs = pool.filter((topic) => topic.mode === "long");
      const [a, b, c, ...answeredRestShorts] = shorts;
      if (a === undefined || b === undefined || c === undefined) {
        throw new Error("expected at least 3 short topics");
      }

      let state: UnitProgressState = {
        answeredTopicIds: [...answeredRestShorts, ...longs].map((t) => t.id),
        skippedTopicIds: [a.id, b.id, c.id],
      };

      expect(nextTopic(1, pool, state, neverCalledRng)?.id).toBe(a.id);

      // a is skipped again: it must not come up before b and c have.
      state = recordSkipped(state, a.id);
      expect(state.skippedTopicIds).toStrictEqual([b.id, c.id, a.id]);
      expect(nextTopic(1, pool, state, neverCalledRng)?.id).toBe(b.id);

      state = recordAnswered(state, b.id);
      expect(nextTopic(1, pool, state, neverCalledRng)?.id).toBe(c.id);

      state = recordAnswered(state, c.id);
      expect(nextTopic(1, pool, state, neverCalledRng)?.id).toBe(a.id);

      state = recordAnswered(state, a.id);
      expect(isCompleted(state)).toBe(true);
    });
  });

  it("shows zero repeated topic ids before every topic in a half has been offered once, over 1000+ draws", () => {
    const rng = mulberry32(1000);
    const skipRng = mulberry32(2000);
    const pool = makeSingleStructurePool("prep");
    let totalDraws = 0;

    for (let pass = 0; pass < 80; pass += 1) {
      const { draws, finalState } = runPass(
        pool,
        rng,
        skipOnceThenAnswer(skipRng, 0.35),
      );

      assertNoRepeatBeforeFullyOffered(
        draws.filter((d) => d.topic.mode === "short").map((d) => d.topic),
      );
      assertNoRepeatBeforeFullyOffered(
        draws.filter((d) => d.topic.mode === "long").map((d) => d.topic),
      );
      expect(isCompleted(finalState)).toBe(true);
      totalDraws += draws.length;
    }

    expect(totalDraws).toBeGreaterThanOrEqual(1000);
  });

  it("has no default rng — omitting it is a type error", () => {
    // @ts-expect-error nextTopic has no default rng; the argument is required.
    const result: Topic | undefined = nextTopic(1, [], EMPTY_STATE);

    expect(result).toBeUndefined();
  });

  describe("unit 4's mixed pool of all 48 topics", () => {
    it("still completes a pass at exactly 16 answered, split 8 short then 8 long", () => {
      const pool = makeFullPool();
      const rng = mulberry32(6);
      const { draws, finalState } = runPass(pool, rng, () => false);

      expect(draws).toHaveLength(TOPICS_PER_PASS);
      expect(
        draws.slice(0, TOPICS_PER_HALF).every((d) => d.topic.mode === "short"),
      ).toBe(true);
      expect(draws.slice(TOPICS_PER_HALF).every((d) => d.topic.mode === "long")).toBe(
        true,
      );
      expect(finalState.answeredTopicIds).toHaveLength(TOPICS_PER_PASS);
      expect(isCompleted(finalState)).toBe(true);
    });

    it("draws across all 3 structures rather than favoring one", () => {
      const pool = makeFullPool();
      const structuresSeen = new Set<StructureType>();

      for (let seed = 0; seed < 20; seed += 1) {
        const rng = mulberry32(seed);
        const { draws } = runPass(pool, rng, () => false);
        for (const { topic } of draws) {
          structuresSeen.add(topic.structure);
        }
      }

      expect(structuresSeen.size).toBe(STRUCTURE_TYPES.length);
    });

    it("never draws more than 8 distinct topics into either half of one pass", () => {
      const pool = makeFullPool();
      const rng = mulberry32(7);
      const { draws } = runPass(pool, rng, skipOnceThenAnswer(mulberry32(70), 0.4));

      const shortIds = new Set(
        draws.filter((d) => d.topic.mode === "short").map((d) => d.topic.id),
      );
      const longIds = new Set(
        draws.filter((d) => d.topic.mode === "long").map((d) => d.topic.id),
      );
      expect(shortIds.size).toBe(TOPICS_PER_HALF);
      expect(longIds.size).toBe(TOPICS_PER_HALF);
    });
  });
});

describe("recordAnswered", () => {
  it("adds the topic id and does not mutate the input state", () => {
    const state: UnitProgressState = Object.freeze({
      answeredTopicIds: Object.freeze(["a"]),
      skippedTopicIds: Object.freeze(["b"]),
    });

    const next = recordAnswered(state, "c");

    expect(next).not.toBe(state);
    expect(next.answeredTopicIds).toStrictEqual(["a", "c"]);
    expect(next.skippedTopicIds).toStrictEqual(["b"]);
    expect(state.answeredTopicIds).toStrictEqual(["a"]);
  });

  it("removes the topic from skippedTopicIds once it is answered", () => {
    const skipped = recordSkipped(EMPTY_STATE, "t1");

    const answered = recordAnswered(skipped, "t1");

    expect(answered.answeredTopicIds).toStrictEqual(["t1"]);
    expect(answered.skippedTopicIds).toStrictEqual([]);
  });

  it("is a no-op when the topic is already answered", () => {
    const state = recordAnswered(EMPTY_STATE, "t1");

    expect(recordAnswered(state, "t1")).toBe(state);
  });
});

describe("recordSkipped", () => {
  it("adds the topic id and does not mutate the input state", () => {
    const state: UnitProgressState = Object.freeze({
      answeredTopicIds: Object.freeze(["a"]),
      skippedTopicIds: Object.freeze(["b"]),
    });

    const next = recordSkipped(state, "c");

    expect(next).not.toBe(state);
    expect(next.skippedTopicIds).toStrictEqual(["b", "c"]);
    expect(next.answeredTopicIds).toStrictEqual(["a"]);
    expect(state.skippedTopicIds).toStrictEqual(["b"]);
  });

  it("is a no-op when the topic is already answered", () => {
    const state = recordAnswered(EMPTY_STATE, "t1");

    const skipped = recordSkipped(state, "t1");

    expect(skipped).toBe(state);
    expect(skipped.answeredTopicIds).toStrictEqual(["t1"]);
  });

  it("moves an id that is already skipped to the end, returning a new state", () => {
    let state = recordSkipped(EMPTY_STATE, "t1");
    state = recordSkipped(state, "t2");

    const next = recordSkipped(state, "t1");

    expect(next).not.toBe(state);
    expect(next.skippedTopicIds).toStrictEqual(["t2", "t1"]);
    expect(next.answeredTopicIds).toStrictEqual(state.answeredTopicIds);
  });
});

describe("isCompleted", () => {
  it.each([
    [0, false],
    [1, false],
    [TOPICS_PER_PASS - 1, false],
    [TOPICS_PER_PASS, true],
    [TOPICS_PER_PASS + 4, true],
  ])(
    "with %i answered, is %s regardless of how many are skipped",
    (answeredCount, expected) => {
      const state: UnitProgressState = {
        answeredTopicIds: Array.from(
          { length: answeredCount },
          (_, i) => `t${i.toString()}`,
        ),
        skippedTopicIds: ["skipped-1", "skipped-2", "skipped-3"],
      };

      expect(isCompleted(state)).toBe(expected);
    },
  );
});
