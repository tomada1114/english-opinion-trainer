import * as z from "zod";

import { CATEGORIES, LEVELS, MODES, STRUCTURE_TYPES } from "../drill";

/**
 * One row of `topics.json`: a question the drill presents, fixed to one
 * structure and one mode.
 *
 * @remarks
 * Strict, so a misspelled key in the committed data fails the load instead of
 * being dropped. `text` is English and never translated.
 */
export const topicSchema = z.strictObject({
  id: z.string().min(1),
  category: z.enum(CATEGORIES),
  structure: z.enum(STRUCTURE_TYPES),
  mode: z.enum(MODES),
  text: z.string().min(1),
});

/** The whole of `topics.json`. */
export const topicsSchema = z.array(topicSchema);

/**
 * One row of `seeds.json`: a stance and one or two key phrases offered to a
 * learner with no opinion of their own, for one topic at one level.
 *
 * @remarks
 * A seed is a prompt to think with, never a full sentence to copy.
 */
export const seedSchema = z.strictObject({
  topicId: z.string().min(1),
  level: z.enum(LEVELS),
  stance: z.string().min(1),
  keyPhrases: z.array(z.string().min(1)).min(1).max(2),
});

/** The whole of `seeds.json`. */
export const seedsSchema = z.array(seedSchema);

/** A validated topic; the schema is the only definition of its shape. */
export type Topic = z.infer<typeof topicSchema>;

/** A validated seed; the schema is the only definition of its shape. */
export type Seed = z.infer<typeof seedSchema>;
