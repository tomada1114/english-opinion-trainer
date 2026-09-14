import * as z from "zod";

import {
  CATEGORIES,
  DEFAULT_DAILY_TARGET,
  DEFAULT_LEVEL,
  LEVELS,
  MODES,
  STRUCTURE_TYPES,
  UNIT_IDS,
} from "./drill";

/**
 * The browser-state document: the one value the app persists, framework-free
 * so every zone above `src/core/` can read its shape.
 *
 * @remarks
 * Where it is stored (`localStorage`) and how React reads it are client-only
 * concerns and live under `src/app/_client/`; this module owns only the shape,
 * its schema, and the migration from whatever was stored to the current shape.
 */

/**
 * The document version this build writes.
 *
 * @remarks
 * A literal, not a `number`: a future version adds a second literal, and
 * {@link migrateState} gains a `switch` over the union rather than reasoning
 * about an open-ended number.
 */
export const STATE_VERSION = 1;

/** One saved rewrite, tagged with the topic it answered. */
export const phraseEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  topicId: z.string(),
  category: z.enum(CATEGORIES),
  structure: z.enum(STRUCTURE_TYPES),
  mode: z.enum(MODES),
  level: z.enum(LEVELS),
  usedSeed: z.boolean(),
  savedAt: z.string(),
  /**
   * When the reader last marked this phrase reviewed, or `null` when they
   * never have. Absent on a document written before this field existed;
   * defaults to `null` rather than failing the parse, so a freshly saved
   * phrase and a never-migrated one are indistinguishable — both are exactly
   * the phrase worth seeing again first.
   */
  lastReviewedAt: z.string().nullable().default(null),
});

/** A phrase-list entry; the schema is the only definition of its shape. */
export type PhraseEntry = z.infer<typeof phraseEntrySchema>;

/** One unit's persisted progress through its current pass. */
export const storedUnitProgressSchema = z.object({
  answeredTopicIds: z.array(z.string()),
  completed: z.boolean(),
});

/** One unit's persisted progress; the schema is the only definition of its shape. */
export type StoredUnitProgress = z.infer<typeof storedUnitProgressSchema>;

/**
 * The whole persisted document.
 *
 * @remarks
 * `units` is partial: a unit appears only once it has progress to record. A key
 * outside {@link UNIT_IDS} fails the parse. Unknown top-level keys are dropped
 * rather than rejected, so a stray key costs nothing but itself.
 *
 * `answeredByDay` and `dailyTarget` default rather than fail the parse when
 * absent, so a document written before these fields existed migrates to their
 * defaults instead of resetting: see {@link migrateState}.
 */
export const stateDocumentSchema = z.object({
  version: z.literal(STATE_VERSION),
  level: z.enum(LEVELS),
  units: z.partialRecord(z.literal(UNIT_IDS), storedUnitProgressSchema),
  phrases: z.array(phraseEntrySchema),
  flaggedTopicIds: z.array(z.string()),
  flaggedSeedIds: z.array(z.string()),
  /** Topics answered per local `YYYY-MM-DD` day; see {@link recordAnsweredDay}. */
  answeredByDay: z.record(z.string(), z.number().int().nonnegative()).default({}),
  /** The count of today's answers the home screen compares against. */
  dailyTarget: z.number().int().positive().default(DEFAULT_DAILY_TARGET),
});

/** The persisted document; the schema is the only definition of its shape. */
export type StateDocument = z.infer<typeof stateDocumentSchema>;

/** A fresh document for a learner with nothing stored yet. */
export function defaultState(): StateDocument {
  return {
    version: STATE_VERSION,
    level: DEFAULT_LEVEL,
    units: {},
    phrases: [],
    flaggedTopicIds: [],
    flaggedSeedIds: [],
    answeredByDay: {},
    dailyTarget: DEFAULT_DAILY_TARGET,
  };
}

/**
 * The current-version document `raw` holds, or {@link defaultState} when it
 * holds nothing this build can read.
 *
 * @remarks
 * Never throws. Unlike the content loader in `src/core/content/`, which
 * `.parse`s committed files, `raw` comes from browser storage the user — or an
 * older build, or another tab — can change, so an unreadable value is an
 * expected, recoverable input rather than a repository bug. Only version 1
 * exists, so a document of any other version resets too; the issue that
 * introduces version 2 adds its migration path here.
 */
export function migrateState(raw: unknown): StateDocument {
  const parsed = stateDocumentSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultState();
}

/** How many days of `answeredByDay` history a write keeps. */
export const ANSWERED_BY_DAY_HISTORY_DAYS = 60;

/**
 * The local calendar day `date` falls on, as `YYYY-MM-DD`.
 *
 * @remarks
 * Reads `date`'s local year/month/day, never the UTC ones: the reader's
 * "today" is the one on their own clock, so a commute at 23:40 belongs to
 * that day rather than rolling to UTC's next one. `answeredByDay` is keyed by
 * this function's output.
 */
export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(year)}-${month}-${day}`;
}

/**
 * `answeredByDay` with `today`'s count incremented by one, keeping only the
 * most recent {@link ANSWERED_BY_DAY_HISTORY_DAYS} days.
 *
 * @remarks
 * Called wherever `recordAnswered` (`src/core/unit-progress.ts`) runs for a
 * topic that completes a unit's pass, so the two stay in step: one answered
 * topic is one increment. `YYYY-MM-DD` keys sort chronologically as plain
 * strings, which is what lets pruning stay a sort-and-slice with no date
 * parsing. Pruning happens on every write rather than as a separate pass, so
 * `answeredByDay` never grows past its cap in a store the reader cannot see.
 */
export function recordAnsweredDay(
  answeredByDay: Readonly<Record<string, number>>,
  today: string,
): Record<string, number> {
  const incremented: Record<string, number> = {
    ...answeredByDay,
    [today]: (answeredByDay[today] ?? 0) + 1,
  };
  const daysToKeep = new Set(
    Object.keys(incremented).sort().slice(-ANSWERED_BY_DAY_HISTORY_DAYS),
  );
  return Object.fromEntries(
    Object.entries(incremented).filter(([day]) => daysToKeep.has(day)),
  );
}
