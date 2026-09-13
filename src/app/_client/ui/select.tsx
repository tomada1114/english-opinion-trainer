import type { ComponentProps, ReactElement } from "react";

import { cn } from "./cn";

/**
 * A styled native `<select>`.
 *
 * @remarks
 * Deliberately native rather than Radix's `Select`: the platform control is
 * already keyboard- and screen-reader-complete, gives a phone its own picker,
 * and keeps the `value`/`onChange` contract the existing callers and their
 * tests are written against. docs/design/design-system.md records the swap.
 */
export function Select({
  className,
  ...props
}: ComponentProps<"select">): ReactElement {
  return (
    <select
      className={cn(
        "rounded-md border border-border bg-surface px-3 text-base text-text",
        "min-h-(--tap-min) transition-colors duration-(--motion-duration-fast)",
        "hover:border-border-strong",
        "disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-text",
        className,
      )}
      {...props}
    />
  );
}
