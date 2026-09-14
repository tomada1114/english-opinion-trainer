"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useId } from "react";

import type { PhraseOrder } from "../../../../core/phrase-order";
import { Label } from "../../../_client/ui/label";
import { Select } from "../../../_client/ui/select";

/** The two-option control that switches the phrase list between {@link PhraseOrder}s. */
export function OrderSelect({
  value,
  onChange,
}: Readonly<{
  value: PhraseOrder;
  onChange: (value: PhraseOrder) => void;
}>): ReactElement {
  const t = useTranslations("Phrases");
  const id = useId();

  return (
    <div className="max-w-xs space-y-1">
      <Label htmlFor={id}>{t("order.label")}</Label>
      <Select
        id={id}
        className="w-full"
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value as PhraseOrder);
        }}
      >
        <option value="newest">{t("order.newest")}</option>
        <option value="review">{t("order.review")}</option>
      </Select>
    </div>
  );
}
