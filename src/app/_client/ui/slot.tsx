import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "./cn";

export type SlotProps = Readonly<{
  className?: string;
  children?: ReactNode;
}> &
  Record<string, unknown>;

/**
 * Renders its single child element in place of a wrapper, merging
 * `className` and forwarding every other prop onto that child.
 *
 * @remarks
 * The one primitive this app took from Radix's `Slot`, narrowed to what
 * `Button`'s `asChild` prop needs: one child, no ref merging, no
 * `Slottable`. `className` is merged with the child's own last, through
 * `cn`, so the caller's classes — `Button`'s computed variant classes, plus
 * whatever `className` a caller of `Button` passed — win over anything the
 * child element already carries.
 */
export function Slot({ className, children, ...props }: SlotProps): ReactElement {
  if (!isValidElement<Readonly<{ className?: string }>>(children)) {
    throw new Error("Slot expects a single React element as its child.");
  }

  return cloneElement(children, {
    ...props,
    className: cn(children.props.className, className),
  });
}
