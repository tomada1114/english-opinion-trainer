import { Check, CircleDashed, CircleDot } from "lucide-react";
import type { ComponentType, ReactElement } from "react";

import type { Verdict } from "../../../../../core/feedback";
import { Badge, type BadgeProps } from "../../../../_client/ui/badge";

/**
 * How each verdict looks. The glyph shapes are deliberately unlike one another
 * — a tick, a filled centre, an empty dashed ring — because `--color-success`
 * and `--color-warning` sit 0.02 apart in OKLCH lightness and are all but
 * identical in greyscale. The shape and the word are what carry the verdict;
 * the tone only reinforces it.
 */
const APPEARANCE: Readonly<
  Record<
    Verdict,
    {
      readonly tone: BadgeProps["tone"];
      readonly Glyph: ComponentType<{ className?: string }>;
    }
  >
> = {
  present: { tone: "success", Glyph: Check },
  weak: { tone: "warning", Glyph: CircleDot },
  absent: { tone: "danger", Glyph: CircleDashed },
};

/** One structural verdict, as a glyph and a word. */
export function VerdictBadge({
  verdict,
  label,
}: Readonly<{ verdict: Verdict; label: string }>): ReactElement {
  const { tone, Glyph } = APPEARANCE[verdict];
  return (
    <Badge tone={tone}>
      <Glyph className="size-3.5 shrink-0" />
      {label}
    </Badge>
  );
}
