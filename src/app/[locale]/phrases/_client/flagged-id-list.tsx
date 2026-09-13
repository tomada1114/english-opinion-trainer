"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useId } from "react";

import type { StateDocument } from "../../../../core/state";

/** Selectable, read-only text areas for ids a learner has flagged. */
export function FlaggedIdList({
  state,
}: Readonly<{ state: StateDocument }>): ReactElement {
  const t = useTranslations("Phrases");
  const topicIdsId = useId();
  const seedIdsId = useId();

  return (
    <section>
      <h2>{t("flagged.heading")}</h2>
      <p>
        <label htmlFor={topicIdsId}>{t("flagged.topicIds")}</label>
      </p>
      <textarea
        id={topicIdsId}
        readOnly
        rows={4}
        value={state.flaggedTopicIds.join("\n")}
      />
      <p>
        <label htmlFor={seedIdsId}>{t("flagged.seedIds")}</label>
      </p>
      <textarea
        id={seedIdsId}
        readOnly
        rows={4}
        value={state.flaggedSeedIds.join("\n")}
      />
    </section>
  );
}
