"use client";

import { useTranslations } from "next-intl";
import { type ReactElement } from "react";

import { getSeedsForTopic } from "../../../../../core/content/index";
import type { Level } from "../../../../../core/drill";
import { Badge } from "../../../../_client/ui/badge";
import { Card } from "../../../../_client/ui/card";
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
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-text">{t("seeds.heading")}</h3>
      <ul className="space-y-2">
        {getSeedsForTopic(topicId, level).map((seed) => {
          const id = seedIdFor(seed.topicId, seed.level, seed.stance);
          const flagged = state.flaggedSeedIds.includes(id);
          return (
            <li key={id}>
              <Card className="space-y-2 bg-bg-subtle">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base text-text">
                    <span className="text-text-muted">{t("seeds.stance")}: </span>
                    {seed.stance}
                  </p>
                  <FlagButton
                    accessibleLabel={`${flagged ? t("flagged") : t("flag")}: ${seed.stance}`}
                    flagged={flagged}
                    onFlag={() => {
                      flagSeed(id);
                    }}
                  />
                </div>
                <p className="text-sm text-text-muted">{t("seeds.keyPhrases")}:</p>
                <ul className="flex flex-wrap gap-1.5">
                  {seed.keyPhrases.map((phrase) => (
                    <li key={phrase}>
                      <Badge>{phrase}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
