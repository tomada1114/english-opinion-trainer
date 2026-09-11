import type { UnitId } from "./drill";
import type { Topic } from "./content";

/**
 * How many distinct topics a pass draws from one mode's half before moving to
 * the other half.
 *
 * @remarks
 * This is a draw cap, not an assertion that the pool holds exactly this many:
 * unit 4's pool holds 24 topics per mode (all three structures combined), and
 * {@link nextTopic} still draws only this many of them per pass, chosen
 * uniformly at random — see {@link pickHalf}.
 */
const TOPICS_PER_HALF = 8;

/** A pass completes once this many topics have been answered. */
const TOPICS_PER_PASS = TOPICS_PER_HALF * 2;

/**
 * One unit's progress through a single pass: which topics have been
 * permanently answered, and which have been shown and skipped but remain
 * eligible to be offered again.
 *
 * @remarks
 * A topic id can be in `skippedTopicIds` or in `answeredTopicIds`, never
 * both — {@link recordAnswered} removes an id from `skippedTopicIds` the
 * moment it is answered, so a skipped-then-answered topic leaves no trace in
 * `skippedTopicIds`.
 */
export interface UnitProgressState {
  readonly answeredTopicIds: readonly string[];
  readonly skippedTopicIds: readonly string[];
}

/**
 * A uniform-random element of `pool`.
 *
 * @remarks
 * Every caller here checks `pool.length > 0` first, so the `undefined` branch
 * never fires; it is checked and thrown on rather than asserted away, per
 * this repository's `noUncheckedIndexedAccess` convention.
 */
function pickRandom<T>(pool: readonly T[], rng: () => number): T {
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  const picked = pool[index];
  if (picked === undefined) {
    throw new Error("pickRandom called with an empty pool");
  }
  return picked;
}

/**
 * The next topic to offer from one mode's half of the pool, or `undefined`
 * once that half has nothing left to offer.
 *
 * @remarks
 * Draws uniformly at random from the topics never yet offered
 * (`answeredTopicIds` and `skippedTopicIds` both exclude them) until
 * {@link TOPICS_PER_HALF} distinct topics have been touched — answered or
 * skipped — which is what caps a larger pool (unit 4's 24-per-mode) down to
 * the per-pass target. After that cap is reached, it draws uniformly at
 * random from whichever of those touched topics are still only skipped, so a
 * skipped topic is only ever eligible again once every other topic in its
 * half has been offered once. It returns `undefined` only once every touched
 * topic in the half has been answered — a half is never abandoned mid-pass
 * because of an unresolved skip.
 */
function pickHalf(
  half: readonly Topic[],
  state: UnitProgressState,
  rng: () => number,
): Topic | undefined {
  const target = Math.min(TOPICS_PER_HALF, half.length);
  const answeredHere = half.filter((topic) =>
    state.answeredTopicIds.includes(topic.id),
  );
  const skippedHere = half.filter((topic) => state.skippedTopicIds.includes(topic.id));
  const touchedCount = answeredHere.length + skippedHere.length;

  if (touchedCount < target) {
    const unshown = half.filter(
      (topic) =>
        !state.answeredTopicIds.includes(topic.id) &&
        !state.skippedTopicIds.includes(topic.id),
    );
    return pickRandom(unshown, rng);
  }

  if (skippedHere.length > 0) {
    return pickRandom(skippedHere, rng);
  }

  return undefined;
}

/**
 * The next topic to present in `unit`'s current pass, or `undefined` once the
 * pass is done.
 *
 * @remarks
 * `unit` is not consulted here: `topicsForUnit` is already the caller's
 * chosen pool (`structureForUnit`'s job for units 1–3, all 48 topics for
 * unit 4's `"mixed"`), and this function only ever draws from it. It stays a
 * parameter for signature parity with the callers this issue unblocks
 * (#9, #16), which do need `unit` to build that pool.
 *
 * The draw is short-first: every eligible `short` topic (see {@link
 * pickHalf}) is offered, and answered or re-offered after a skip, before any
 * `long` topic is drawn. `undefined` at {@link TOPICS_PER_PASS} answered is
 * one way this returns `undefined`; a pool smaller than a full 16-topic pass
 * (as in a test fixture) exhausts the same way once nothing is left to draw.
 */
export function nextTopic(
  unit: UnitId,
  topicsForUnit: readonly Topic[],
  state: UnitProgressState,
  rng: () => number,
): Topic | undefined {
  if (state.answeredTopicIds.length >= TOPICS_PER_PASS) {
    return undefined;
  }

  const shorts = topicsForUnit.filter((topic) => topic.mode === "short");
  const longs = topicsForUnit.filter((topic) => topic.mode === "long");

  return pickHalf(shorts, state, rng) ?? pickHalf(longs, state, rng);
}

/**
 * `state` with `topicId` recorded as answered: added to `answeredTopicIds`
 * (once) and removed from `skippedTopicIds` if it was there. Returns `state`
 * unchanged, not a new object, when `topicId` was already answered.
 */
export function recordAnswered(
  state: UnitProgressState,
  topicId: string,
): UnitProgressState {
  if (state.answeredTopicIds.includes(topicId)) {
    return state;
  }

  return {
    answeredTopicIds: [...state.answeredTopicIds, topicId],
    skippedTopicIds: state.skippedTopicIds.filter((id) => id !== topicId),
  };
}

/**
 * `state` with `topicId` recorded as skipped: added to `skippedTopicIds`
 * (once) so {@link nextTopic} offers it again later. A no-op — `state`
 * unchanged — when `topicId` is already answered (answered is permanent) or
 * already skipped.
 */
export function recordSkipped(
  state: UnitProgressState,
  topicId: string,
): UnitProgressState {
  if (
    state.answeredTopicIds.includes(topicId) ||
    state.skippedTopicIds.includes(topicId)
  ) {
    return state;
  }

  return {
    answeredTopicIds: state.answeredTopicIds,
    skippedTopicIds: [...state.skippedTopicIds, topicId],
  };
}

/** Whether `state`'s pass has reached {@link TOPICS_PER_PASS} answers. */
export function isCompleted(state: UnitProgressState): boolean {
  return state.answeredTopicIds.length >= TOPICS_PER_PASS;
}
