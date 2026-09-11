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
 * drawn again by this function: a pending skip is {@link
 * pickNextPendingSkip}'s job, deliberately kept separate so this half's
 * first round finishes (and the other half's first round can start)
 * without waiting on it.
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
 * The front of the pending-skip queue: the topic named by the earliest id in
 * `skippedTopicIds` that belongs to `pool`, or `undefined` when none is
 * pending.
 *
 * @remarks
 * No `rng` here — `skippedTopicIds`' own insertion order is the queue.
 * {@link recordSkipped} appends a newly-skipped id and moves an
 * already-pending one to the end, so a short id naturally precedes a long
 * one (every short topic is offered, and any skip recorded, before the long
 * half begins), and a topic skipped again waits behind everything else
 * still pending.
 */
function pickNextPendingSkip(
  pool: readonly Topic[],
  state: UnitProgressState,
): Topic | undefined {
  const pendingId = state.skippedTopicIds.find((id) =>
    pool.some((topic) => topic.id === id),
  );
  if (pendingId === undefined) {
    return undefined;
  }
  return pool.find((topic) => topic.id === pendingId);
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
 * Three stages, each exhausted before the next begins: every `short` topic
 * offered once ({@link pickUnshown}, random order); every `long` topic
 * offered once the same way — a pending short skip does **not** hold this
 * up; then the still-pending skips re-offered in queue order ({@link
 * pickNextPendingSkip}: short before long, since they were recorded first)
 * until every one is answered. `undefined` at {@link TOPICS_PER_PASS}
 * answered is one way this returns `undefined`; a pool smaller than a full
 * 16-topic pass (as in a test fixture) exhausts the same way.
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
    pickNextPendingSkip(topicsForUnit, state)
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
 * `state` with `topicId` moved to the end of `skippedTopicIds`, so {@link
 * nextTopic} offers it again only once everything else still pending has
 * been. A no-op — `state` unchanged — when `topicId` is already answered
 * (answered is permanent); otherwise always a new state, even for an
 * already-pending `topicId` whose position does not change.
 */
export function recordSkipped(
  state: UnitProgressState,
  topicId: string,
): UnitProgressState {
  if (state.answeredTopicIds.includes(topicId)) {
    return state;
  }

  return {
    answeredTopicIds: state.answeredTopicIds,
    skippedTopicIds: [...state.skippedTopicIds.filter((id) => id !== topicId), topicId],
  };
}

/** Whether `state`'s pass has reached {@link TOPICS_PER_PASS} answers. */
export function isCompleted(state: UnitProgressState): boolean {
  return state.answeredTopicIds.length >= TOPICS_PER_PASS;
}
