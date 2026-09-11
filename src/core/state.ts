import * as z from "zod";

import {
  CATEGORIES,
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
 */
export const stateDocumentSchema = z.object({
  version: z.literal(STATE_VERSION),
  level: z.enum(LEVELS),
  units: z.partialRecord(z.literal(UNIT_IDS), storedUnitProgressSchema),
  phrases: z.array(phraseEntrySchema),
  flaggedTopicIds: z.array(z.string()),
  flaggedSeedIds: z.array(z.string()),
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
