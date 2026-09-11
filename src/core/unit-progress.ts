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
 * uniformly at random — see {@link pickUnshown}.
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
 * The next never-yet-offered topic of one mode's half, or `undefined` once
 * every topic of the half has been offered once (answered or skipped).
 *
 * @remarks
 * Draws uniformly at random from the topics neither answered nor skipped,
 * until {@link TOPICS_PER_HALF} distinct topics have been touched — which is
 * what caps a larger pool (unit 4's 24-per-mode) down to the per-pass target.
 * A topic already offered, whether answered or still only skipped, is never
 * drawn again by this function: a pending skip is {@link pickPendingSkip}'s
 * job, deliberately kept separate so this half's first round finishes (and
 * the other half's first round can start) without waiting on it.
 */
function pickUnshown(
  half: readonly Topic[],
  state: UnitProgressState,
  rng: () => number,
): Topic | undefined {
  const target = Math.min(TOPICS_PER_HALF, half.length);
  const touchedCount = half.filter(
    (topic) =>
      state.answeredTopicIds.includes(topic.id) ||
      state.skippedTopicIds.includes(topic.id),
  ).length;

  if (touchedCount >= target) {
    return undefined;
  }

  const unshown = half.filter(
    (topic) =>
      !state.answeredTopicIds.includes(topic.id) &&
      !state.skippedTopicIds.includes(topic.id),
  );
  return pickRandom(unshown, rng);
}

/**
 * A uniform-random still-skipped (not yet answered) topic of one mode's
 * half, or `undefined` when none is pending.
 */
function pickPendingSkip(
  half: readonly Topic[],
  state: UnitProgressState,
  rng: () => number,
): Topic | undefined {
  const pending = half.filter((topic) => state.skippedTopicIds.includes(topic.id));
  if (pending.length === 0) {
    return undefined;
  }
  return pickRandom(pending, rng);
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
 * The draw runs in four stages, each exhausted before the next begins:
 * every `short` topic offered once ({@link pickUnshown}, random order), then
 * every `long` topic offered once the same way — a short topic left pending
 * by a skip does **not** hold up the `long` half — then the still-pending
 * `short` skips re-offered (random order, a re-skipped one simply staying
 * eligible) until every one is answered, then the still-pending `long`
 * skips the same way. `undefined` at {@link TOPICS_PER_PASS} answered is one
 * way this returns `undefined`; a pool smaller than a full 16-topic pass (as
 * in a test fixture) exhausts the same way once nothing is left to draw.
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

  return (
    pickUnshown(shorts, state, rng) ??
    pickUnshown(longs, state, rng) ??
    pickPendingSkip(shorts, state, rng) ??
    pickPendingSkip(longs, state, rng)
  );
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
