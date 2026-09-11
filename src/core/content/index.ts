import type { Level } from "../drill";
import { type Seed, seedsSchema, type Topic, topicsSchema } from "./schema";
import seedsJson from "./seeds.json";
import topicsJson from "./topics.json";

export {
  type Seed,
  seedSchema,
  seedsSchema,
  type Topic,
  topicSchema,
  topicsSchema,
} from "./schema";

// `.parse`, not `.safeParse`: a malformed committed file is a repository bug
// with no caller-side recovery, so it fails every test and every build at
// import rather than surfacing as a 500 on the first request that reaches it.
const TOPICS: readonly Topic[] = Object.freeze(topicsSchema.parse(topicsJson));
const SEEDS: readonly Seed[] = Object.freeze(seedsSchema.parse(seedsJson));

const TOPICS_BY_ID: ReadonlyMap<string, Topic> = new Map(
  TOPICS.map((topic) => [topic.id, topic]),
);

/** Every topic, in the order `topics.json` lists them. */
export function getTopics(): readonly Topic[] {
  return TOPICS;
}

/**
 * The topic whose `id` is `id`, or `undefined` when no topic has it.
 *
 * @remarks
 * `undefined` is the expected answer for an id a caller could not have
 * validated — one taken from a request body — so it is returned, not thrown.
 */
export function getTopicById(id: string): Topic | undefined {
  return TOPICS_BY_ID.get(id);
}

/** The seeds for `topicId` at `level`; empty when there are none. */
export function getSeedsForTopic(topicId: string, level: Level): readonly Seed[] {
  return SEEDS.filter((seed) => seed.topicId === topicId && seed.level === level);
}
