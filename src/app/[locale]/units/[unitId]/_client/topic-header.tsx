import { useTranslations } from "next-intl";
import type { ReactElement } from "react";

import type { Topic } from "../../../../../core/content/index";
import { STRUCTURE_TEMPLATES } from "../../../../../core/drill";
import { FlagButton } from "./flag-button";

/**
 * The topic being answered, and what shape the answer is expected to take.
 *
 * @remarks
 * The topic text is the `h2`: it is what this screen is about, and a screen
 * reader's heading list should say so rather than naming the section "Answer".
 */
export function TopicHeader({
  topic,
  flagged,
  onFlag,
}: Readonly<{
  topic: Topic;
  flagged: boolean;
  onFlag: () => void;
}>): ReactElement {
  const t = useTranslations("Drill");

  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-2xl leading-tight font-semibold text-text">{topic.text}</h2>
        <FlagButton flagged={flagged} onFlag={onFlag} />
      </div>
      <p className="text-sm text-text-muted">
        {t("structureLabel")}: {STRUCTURE_TEMPLATES[topic.structure]}
      </p>
      <p className="text-sm text-text-muted">{t(`mode.${topic.mode}`)}</p>
    </header>
  );
}
