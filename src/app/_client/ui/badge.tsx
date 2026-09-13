import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";

import { cn } from "./cn";

const badgeStyles = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-surface text-text-muted",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        danger: "bg-danger-subtle text-danger",
        // A count is a quantity, not a judgement, so it carries no status hue.
        count: "bg-surface text-text-muted font-normal tabular-nums",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeStyles>;

/**
 * A small inline label.
 *
 * @remarks
 * A tone is never the only carrier of meaning: callers pass a glyph and a word
 * alongside it, so the badge still reads in greyscale and under forced colours.
 */
export function Badge({ className, tone, ...props }: BadgeProps): ReactElement {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}
