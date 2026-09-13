"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useId } from "react";

import type { StateDocument } from "../../../../core/state";
import { Disclosure } from "../../../_client/ui/disclosure";
import { Label } from "../../../_client/ui/label";
import { Textarea } from "../../../_client/ui/textarea";

/**
 * Selectable, read-only text areas for ids a learner has flagged.
 *
 * @remarks
 * Behind a disclosure: these are raw ids, useful for reporting a bad topic or
 * seed and of no use while practising, so they are reachable without competing
 * with the phrases above them. `readOnly` rather than `disabled` here on
 * purpose — unlike the answer field, the point is to select and copy the text.
 */
export function FlaggedIdList({
  state,
}: Readonly<{ state: StateDocument }>): ReactElement {
  const t = useTranslations("Phrases");
  const topicIdsId = useId();
  const seedIdsId = useId();

  return (
    <Disclosure
      summary={t("flagged.heading")}
      count={state.flaggedTopicIds.length + state.flaggedSeedIds.length}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={topicIdsId}>{t("flagged.topicIds")}</Label>
          <Textarea
            id={topicIdsId}
            readOnly
            rows={3}
            className="font-mono text-sm"
            value={state.flaggedTopicIds.join("\n")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={seedIdsId}>{t("flagged.seedIds")}</Label>
          <Textarea
            id={seedIdsId}
            readOnly
            rows={3}
            className="font-mono text-sm"
            value={state.flaggedSeedIds.join("\n")}
          />
        </div>
      </div>
    </Disclosure>
  );
}
