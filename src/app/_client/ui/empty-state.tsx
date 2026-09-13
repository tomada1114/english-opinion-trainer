import type { ReactElement, ReactNode } from "react";

import { cn } from "./cn";

/**
 * An empty list, with the next action on it.
 *
 * @remarks
 * The two variants must not be merged. `onboarding` is "you have not done the
 * thing yet" and names the thing; `filtered-out` is "your filters excluded
 * everything" and offers to widen them. They lead to different next actions, so
 * one shared component with one message would strand the reader in whichever
 * case it was not written for.
 */
export function EmptyState({
  variant,
  heading,
  body,
  action,
}: Readonly<{
  variant: "onboarding" | "filtered-out";
  heading: string;
  body: string;
  action?: ReactNode;
}>): ReactElement {
  return (
    <div
      data-variant={variant}
      className={cn(
        "rounded-lg border border-dashed border-border px-4 py-8 text-center",
        variant === "onboarding" ? "bg-bg-elevated" : "bg-transparent",
      )}
    >
      <p className="text-base font-medium text-text">{heading}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm text-text-muted">{body}</p>
      {action === undefined ? null : <div className="mt-4">{action}</div>}
    </div>
  );
}
