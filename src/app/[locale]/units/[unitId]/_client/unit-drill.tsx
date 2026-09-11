"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useState, useSyncExternalStore } from "react";

import type { Topic } from "../../../../../core/content/index";
import type { UnitId } from "../../../../../core/drill";
import {
  isCompleted,
  nextTopic,
  recordAnswered,
  recordSkipped,
  type UnitProgressState,
} from "../../../../../core/unit-progress";
import { Link } from "../../../../../i18n/navigation";
import { TopicAttempt } from "./topic-attempt";

const NEW_PASS: UnitProgressState = { answeredTopicIds: [], skippedTopicIds: [] };

/**
 * One pass through a unit, held in memory only.
 *
 * @remarks
 * `turn` counts every advance and keys the attempt, so a skipped topic that
 * comes straight back — the only one still pending — starts from a blank
 * answer rather than the one it was skipped with.
 */
interface Session {
  readonly progress: UnitProgressState;
  readonly topic: Topic | undefined;
  readonly turn: number;
}

function sessionAt(
  unit: UnitId,
  topics: readonly Topic[],
  progress: UnitProgressState,
  turn: number,
): Session {
  return { progress, topic: nextTopic(unit, topics, progress, Math.random), turn };
}

function subscribeToNothing(): () => void {
  return () => undefined;
}

/**
 * The drill for one unit: its topics, one at a time, until the pass is done.
 *
 * @remarks
 * The first topic is drawn at random, so drawing it during the server render
 * would hand the client a different topic to hydrate against. The server —
 * and a prerender — render a placeholder instead, and the session starts once
 * the page is running in a browser. Progress lives in this component's state;
 * it is lost on reload until persisted progress (#16) lands.
 */
export function UnitDrill({
  unit,
  topics,
}: Readonly<{ unit: UnitId; topics: readonly Topic[] }>): ReactElement {
  const t = useTranslations("Drill");
  const inBrowser = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  return inBrowser ? (
    <DrillSession unit={unit} topics={topics} />
  ) : (
    <p>{t("loading")}</p>
  );
}

function DrillSession({
  unit,
  topics,
}: Readonly<{ unit: UnitId; topics: readonly Topic[] }>): ReactElement {
  const t = useTranslations("Drill");
  const [session, setSession] = useState(() => sessionAt(unit, topics, NEW_PASS, 0));
  const { progress, topic, turn } = session;

  if (topic === undefined || isCompleted(progress)) {
    return (
      <section>
        <h2>{t("complete.heading")}</h2>
        <p>{t("complete.body")}</p>
        <p>
          <button
            type="button"
            onClick={() => {
              setSession(sessionAt(unit, topics, NEW_PASS, turn + 1));
            }}
          >
            {t("complete.restart")}
          </button>{" "}
          <Link href="/">{t("complete.homeLink")}</Link>
        </p>
      </section>
    );
  }

  return (
    <>
      <p>{t("progress", { count: progress.answeredTopicIds.length })}</p>
      <TopicAttempt
        key={turn}
        topic={topic}
        onAnswered={() => {
          setSession(
            sessionAt(unit, topics, recordAnswered(progress, topic.id), turn + 1),
          );
        }}
        onSkip={() => {
          setSession(
            sessionAt(unit, topics, recordSkipped(progress, topic.id), turn + 1),
          );
        }}
      />
    </>
  );
}
