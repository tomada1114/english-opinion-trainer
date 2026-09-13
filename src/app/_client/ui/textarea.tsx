import type { ComponentProps, ReactElement } from "react";

import { cn } from "./cn";

/**
 * A multi-line text field.
 *
 * @remarks
 * `disabled` is styled explicitly, and is what callers use while a request is
 * in flight — `readOnly` changes nothing a reader can see, which is the whole
 * defect this styling exists to fix. `field-sizing-content` lets the box grow
 * with the text instead of pinning a height, which 1.4.12 needs.
 */
export function Textarea({
  className,
  ...props
}: ComponentProps<"textarea">): ReactElement {
  return (
    <textarea
      className={cn(
        "block w-full rounded-md border border-border bg-surface px-3 py-2",
        "text-base text-text placeholder:text-text-subtle",
        "field-sizing-content min-h-24 resize-y",
        "transition-colors duration-(--motion-duration-fast)",
        "hover:border-border-strong",
        "aria-invalid:border-danger",
        "disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-text-muted",
        className,
      )}
      {...props}
    />
  );
}
