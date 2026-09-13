"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactElement } from "react";

import { Button } from "../../../../_client/ui/button";

interface FlagButtonProps {
  readonly accessibleLabel?: string;
  readonly flagged: boolean;
  readonly onFlag: () => void;
}

/**
 * A one-way flag action whose label stays visibly flagged after the write.
 *
 * @remarks
 * The filled glyph, not a colour, is what distinguishes flagged from unflagged —
 * and the label changes too, so the state is legible in greyscale and to a
 * screen reader without either.
 */
export function FlagButton({
  accessibleLabel,
  flagged,
  onFlag,
}: FlagButtonProps): ReactElement {
  const t = useTranslations("Drill");

  return (
    <Button variant="ghost" size="sm" aria-label={accessibleLabel} onClick={onFlag}>
      <Flag
        aria-hidden="true"
        className={flagged ? "size-4 fill-current text-warning" : "size-4"}
      />
      {flagged ? t("flagged") : t("flag")}
    </Button>
  );
}
