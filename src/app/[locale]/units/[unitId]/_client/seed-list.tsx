"use client";

import { useTranslations } from "next-intl";
import { type ReactElement } from "react";

import { getSeedsForTopic } from "../../../../../core/content/index";
import type { Level } from "../../../../../core/drill";
import { useStateDocument } from "../../../../_client/use-state-document";
import { FlagButton } from "./flag-button";

function seedIdFor(topicId: string, level: Level, stance: string): string {
  return `${topicId}:${level}:${stance}`;
}

/** The revealed seed rows, including their one-way flag actions. */
export function SeedList({
  topicId,
  level,
}: Readonly<{ topicId: string; level: Level }>): ReactElement {
  const t = useTranslations("Drill");
  const { state, setState } = useStateDocument();

  function flagSeed(id: string): void {
    setState((current) =>
      current.flaggedSeedIds.includes(id)
        ? current
        : { ...current, flaggedSeedIds: [...current.flaggedSeedIds, id] },
    );
  }

  return (
    <section>
      <h3>{t("seeds.heading")}</h3>
      <ul>
        {getSeedsForTopic(topicId, level).map((seed) => {
          const id = seedIdFor(seed.topicId, seed.level, seed.stance);
          const flagged = state.flaggedSeedIds.includes(id);
          return (
            <li key={id}>
              <p>
                <strong>{t("seeds.stance")}:</strong> {seed.stance}{" "}
                <FlagButton
                  accessibleLabel={`${flagged ? t("flagged") : t("flag")}: ${seed.stance}`}
                  flagged={flagged}
                  onFlag={() => {
                    flagSeed(id);
                  }}
                />
              </p>
              <p>
                <strong>{t("seeds.keyPhrases")}:</strong>
              </p>
              <ul>
                {seed.keyPhrases.map((phrase) => (
                  <li key={phrase}>{phrase}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
