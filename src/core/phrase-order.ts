import type { PhraseEntry } from "./state";

/**
 * How the phrase list is sorted: `newest` is today's behaviour (unchanged,
 * and the default), `review` turns the list into a review surface —
 * never-reviewed phrases first, then the least-recently-reviewed, `savedAt`
 * breaking ties either way.
 */
export type PhraseOrder = "newest" | "review";

/** The order shown with nothing chosen — unchanged from before this field existed. */
export const DEFAULT_PHRASE_ORDER: PhraseOrder = "newest";

/**
 * `lastReviewedAt` parsed to milliseconds, or `null` for a phrase never
 * reviewed — kept as `null` rather than a sentinel number so two never-reviewed
 * phrases compare as a tie (falling through to the `savedAt` tiebreak) instead
 * of `-Infinity - -Infinity`, which is `NaN` and not a valid ordering.
 */
function reviewOrderKey(phrase: PhraseEntry): number | null {
  return phrase.lastReviewedAt === null ? null : Date.parse(phrase.lastReviewedAt);
}

/**
 * A comparator for `Array.prototype.sort` matching {@link PhraseOrder}.
 *
 * @remarks
 * `newest` sorts by `savedAt` descending, same as before this field existed.
 * `review` sorts by {@link reviewOrderKey} ascending — nulls (never reviewed)
 * first, then the oldest `lastReviewedAt` — breaking a tie (including a tie
 * between two never-reviewed phrases) by `savedAt` ascending, so the phrase
 * that has waited longest for either a look or a re-look comes first.
 */
export function comparePhrasesByOrder(
  order: PhraseOrder,
): (left: PhraseEntry, right: PhraseEntry) => number {
  return (left, right) => {
    if (order === "newest") {
      return Date.parse(right.savedAt) - Date.parse(left.savedAt);
    }
    const leftKey = reviewOrderKey(left);
    const rightKey = reviewOrderKey(right);
    if (leftKey === null && rightKey === null) {
      return Date.parse(left.savedAt) - Date.parse(right.savedAt);
    }
    if (leftKey === null) {
      return -1;
    }
    if (rightKey === null) {
      return 1;
    }
    const reviewDiff = leftKey - rightKey;
    return reviewDiff !== 0
      ? reviewDiff
      : Date.parse(left.savedAt) - Date.parse(right.savedAt);
  };
}
