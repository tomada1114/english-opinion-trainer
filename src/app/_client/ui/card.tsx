import type { ComponentProps, ReactElement } from "react";

import { cn } from "./cn";

/**
 * A raised panel.
 *
 * @remarks
 * The border is not decoration: `forced-colors: active` drops `box-shadow`,
 * so a panel whose only boundary was a shadow would lose its edge there.
 */
export function Card({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-bg-elevated p-4 shadow-(--shadow-1)",
        className,
      )}
      {...props}
    />
  );
}
