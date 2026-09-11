"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useState } from "react";

import {
  useStateDocument,
  type StateDocumentHandle,
} from "../../../../_client/use-state-document";
import type { Topic } from "../../../../../core/content/index";
import type { Level, UnitId } from "../../../../../core/drill";
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
 * One pass through a unit, with answered topics persisted in the browser.
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

/**
 * The drill for one unit: its topics, one at a time, until the pass is done.
 *
 * @remarks
 * The first topic is drawn at random, so drawing it during the server render
 * would hand the client a different topic to hydrate against. The server —
 * and a prerender — render a placeholder instead, and the session starts once
 * the browser state document has been loaded. Skipped topics remain in this
 * component's state; only answered topics and completion are persisted.
 */
export function UnitDrill({
  unit,
  topics,
}: Readonly<{ unit: UnitId; topics: readonly Topic[] }>): ReactElement {
  const t = useTranslations("Drill");
  const { state, loaded, setState } = useStateDocument();

  if (!loaded) {
    return <p>{t("loading")}</p>;
  }

  const storedProgress = state.units[unit];
  const initialProgress: UnitProgressState = {
    answeredTopicIds: storedProgress?.answeredTopicIds ?? [],
    skippedTopicIds: [],
  };

  return (
    <DrillSession
      key={unit}
      unit={unit}
      topics={topics}
      level={state.level}
      initialProgress={initialProgress}
      setState={setState}
    />
  );
}

function DrillSession({
  unit,
  topics,
  level,
  initialProgress,
  setState,
}: Readonly<{
  unit: UnitId;
  topics: readonly Topic[];
  level: Level;
  initialProgress: UnitProgressState;
  setState: StateDocumentHandle["setState"];
}>): ReactElement {
  const t = useTranslations("Drill");
  const [session, setSession] = useState(() =>
    sessionAt(unit, topics, initialProgress, 0),
  );
  const { progress, topic, turn } = session;

  function persistProgress(nextProgress: UnitProgressState): void {
    const passCompleted = isCompleted(nextProgress);
    setState((current) => ({
      ...current,
      units: {
        ...current.units,
        [unit]: {
          answeredTopicIds: [...nextProgress.answeredTopicIds],
          completed: passCompleted || current.units[unit]?.completed === true,
        },
      },
    }));
  }

  function restart(): void {
    setState((current) => ({
      ...current,
      units: {
        ...current.units,
        [unit]: {
          answeredTopicIds: [],
          completed: current.units[unit]?.completed === true,
        },
      },
    }));
    setSession(sessionAt(unit, topics, NEW_PASS, turn + 1));
  }

  if (topic === undefined || isCompleted(progress)) {
    return (
      <section>
        <h2>{t("complete.heading")}</h2>
        <p>{t("complete.body")}</p>
        <p>
          <button type="button" onClick={restart}>
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
        level={level}
        onAnswered={() => {
          const nextProgress = recordAnswered(progress, topic.id);
          persistProgress(nextProgress);
          setSession(sessionAt(unit, topics, nextProgress, turn + 1));
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
