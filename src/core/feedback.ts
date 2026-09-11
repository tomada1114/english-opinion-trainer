import * as z from "zod";

import {
  type ElementKey,
  elementsFor,
  type ElementsFor,
  type Mode,
  type StructureType,
} from "./drill";

/**
 * The feedback schema: the shape one model call answers an attempt with.
 *
 * @remarks
 * This is the wire contract a structured-output call is validated against, so
 * two absences are deliberate. No string or array carries a length or count
 * bound: the structured-outputs wire schema cannot express one, and the SDK
 * would demote it to description text rather than enforce it — the server
 * clamps counts after the answer arrives instead. And there is no score field
 * anywhere: the drill judges structure and offers a rewrite, it never grades.
 *
 * Every object is strict. The wire schema carries `additionalProperties: false`
 * on each object regardless, and zod's default of stripping unknown keys would
 * let a local `safeParse` accept what that contract rejects.
 */

/** How present one element of the structure is in the answer. */
export const VERDICTS = ["present", "weak", "absent"] as const;

/** One of {@link VERDICTS}. */
export type Verdict = (typeof VERDICTS)[number];

const elementJudgementSchema = z.strictObject({
  verdict: z.enum(VERDICTS),
  reason: z.string(),
});

type ElementJudgementSchema = typeof elementJudgementSchema;

function buildFeedbackSchema<TStructure extends Record<string, ElementJudgementSchema>>(
  structureShape: TStructure,
) {
  return z.strictObject({
    structure: z.strictObject(structureShape),
    fixes: z.array(
      z.strictObject({ before: z.string(), after: z.string(), why: z.string() }),
    ),
    rewrite: z.string(),
    grammar: z.array(
      z.strictObject({ excerpt: z.string(), correction: z.string(), note: z.string() }),
    ),
  });
}

/**
 * The schema {@link feedbackSchemaFor} returns for structure `S` in mode `M`.
 *
 * @remarks
 * Distributes over `S` and `M`, so left wide it is the union of all six
 * concrete shapes rather than one shape demanding every element key at once.
 */
export type FeedbackSchema<
  S extends StructureType = StructureType,
  M extends Mode = Mode,
> = S extends StructureType
  ? M extends Mode
    ? ReturnType<
        typeof buildFeedbackSchema<
          Record<ElementsFor<S, M>[number], ElementJudgementSchema>
        >
      >
    : never
  : never;

/**
 * The feedback schema for an answer in `structure` and `mode`.
 *
 * @remarks
 * `structure` holds exactly the keys {@link elementsFor} judges for that
 * structure and mode, each required, so the wire schema fixes which elements
 * the model may answer with. It says nothing about their order: an element
 * counts wherever the answer places it.
 *
 * A literal call such as `feedbackSchemaFor("prep", "short")` is typed with
 * exactly that shape's keys.
 */
export function feedbackSchemaFor<S extends StructureType, M extends Mode>(
  structure: S,
  mode: M,
): FeedbackSchema<S, M>;
// Overloaded for the same reason as elementsFor in ./drill: the narrowed
// signature is a conditional type over unresolved generics.
export function feedbackSchemaFor(
  structure: StructureType,
  mode: Mode,
): ReturnType<typeof buildFeedbackSchema<Record<string, ElementJudgementSchema>>> {
  const judged: readonly ElementKey[] = elementsFor(structure, mode);
  return buildFeedbackSchema(
    Object.fromEntries(judged.map((key) => [key, elementJudgementSchema])),
  );
}

/**
 * One parsed feedback answer, for a caller that does not need the narrow
 * per-shape type: the union of all six concrete shapes.
 *
 * @remarks
 * Not `ReturnType<typeof feedbackSchemaFor>`: that instantiates the generics
 * as `unknown`, which the distributive {@link FeedbackSchema} maps to `never`.
 */
export type Feedback = z.infer<FeedbackSchema>;
