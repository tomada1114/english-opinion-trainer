import type { ComponentProps, ReactElement } from "react";

import { cn } from "./cn";

/** A form label. Always rendered — a placeholder is not a label. */
export function Label({ className, ...props }: ComponentProps<"label">): ReactElement {
  return (
    <label
      className={cn("block text-sm font-medium text-text", className)}
      {...props}
    />
  );
}
