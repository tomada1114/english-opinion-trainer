"use client";

import { useTranslations } from "next-intl";
import { type ReactElement } from "react";

interface FlagButtonProps {
  readonly accessibleLabel?: string;
  readonly flagged: boolean;
  readonly onFlag: () => void;
}

/** A one-way flag action whose label stays visibly flagged after the write. */
export function FlagButton({
  accessibleLabel,
  flagged,
  onFlag,
}: FlagButtonProps): ReactElement {
  const t = useTranslations("Drill");

  return (
    <button type="button" aria-label={accessibleLabel} onClick={onFlag}>
      {flagged ? t("flagged") : t("flag")}
    </button>
  );
}
