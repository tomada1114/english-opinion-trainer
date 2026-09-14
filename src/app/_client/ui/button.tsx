import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";

import { cn } from "./cn";
import { Slot } from "./slot";

/**
 * The four button appearances this app has, and the two sizes.
 *
 * @remarks
 * Every variant states hover, focus-visible, active and disabled. `disabled:`
 * uses the disabled token pair rather than an opacity on the element, because
 * an opacity also dims nested text and makes the contrast unmeasurable.
 * `hover:` sits behind `@media (hover: hover)` — Tailwind's `hover:` already
 * compiles to that — so a tap does not leave a stuck hover colour.
 */
const buttonStyles = cva(
  cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium no-underline",
    "min-h-(--tap-min) transition-colors duration-(--motion-duration-fast) ease-standard",
    "active:scale-[0.98] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:bg-disabled-bg disabled:text-disabled-text",
  ),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-text-on-primary hover:bg-primary-hover active:bg-primary-active",
        secondary: cn(
          "bg-surface text-text border border-border",
          "hover:bg-surface-hover hover:border-border-strong",
        ),
        ghost: "bg-transparent text-text-muted hover:bg-surface-hover hover:text-text",
        destructive: cn(
          "bg-transparent text-danger border border-danger/60",
          "hover:bg-danger hover:text-text-on-danger hover:border-danger",
        ),
      },
      size: {
        sm: "px-3 text-sm",
        md: "px-4 text-base",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonStyles> & {
    /** Render the child element instead of a `<button>`, keeping the styling. */
    readonly asChild?: boolean;
  };

/** A button, or any element styled as one when `asChild` is set. */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps): ReactElement {
  if (asChild) {
    // `type` is meaningless on the anchor or Link this branch renders, and
    // passing it through would put an invalid attribute on the element.
    return (
      <Slot className={cn(buttonStyles({ variant, size }), className)} {...props} />
    );
  }
  return (
    <button
      type={type}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}
