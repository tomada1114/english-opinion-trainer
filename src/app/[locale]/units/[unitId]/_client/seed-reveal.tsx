import { useTranslations } from "next-intl";
import { type ReactElement, useState } from "react";

import type { Level } from "../../../../../core/drill";
import { Button } from "../../../../_client/ui/button";
import { SeedList } from "./seed-list";

/**
 * The seeds, and the button that reveals them.
 *
 * @remarks
 * The button disappears once the seeds are showing: keeping a control whose only
 * effect has already happened is noise, and the seed rows themselves are the
 * evidence it was pressed. Revealing is reported upward because the attempt
 * records whether a seed was used, and a phrase saved from a seeded answer is
 * filtered differently from one written cold.
 */
export function SeedReveal({
  topicId,
  level,
  disabled,
  onReveal,
}: Readonly<{
  topicId: string;
  level: Level;
  disabled: boolean;
  onReveal: () => void;
}>): ReactElement {
  const t = useTranslations("Drill");
  const [showSeeds, setShowSeeds] = useState(false);

  return (
    <div className="space-y-3">
      {showSeeds ? (
        <SeedList topicId={topicId} level={level} />
      ) : (
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => {
            setShowSeeds(true);
            onReveal();
          }}
        >
          {t("showSeeds")}
        </Button>
      )}
    </div>
  );
}
