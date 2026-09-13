import { ChevronRight } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Badge } from "./badge";
import { cn } from "./cn";

/**
 * A collapsible section built on `<details>`/`<summary>`.
 *
 * @remarks
 * Native rather than Radix's `Collapsible` on purpose: the browser's own
 * element is findable by in-page search when closed, and renders open with no
 * JavaScript at all. Neither is true of a JS-driven panel, and both matter for
 * feedback the reader may want to search rather than click through.
 */
export function Disclosure({
  summary,
  count,
  defaultOpen = false,
  children,
}: Readonly<{
  summary: string;
  /** Shown as a count badge. Omit where there is nothing to count. */
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}>): ReactElement {
  return (
    <details
      className="group rounded-md border border-border bg-bg-elevated"
      open={defaultOpen}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-md px-3",
          "min-h-(--tap-min) text-base font-medium text-text",
          "transition-colors duration-(--motion-duration-fast)",
          "hover:bg-surface-hover",
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-text-muted",
            "transition-transform duration-(--motion-duration-base) ease-standard",
            "group-open:rotate-90",
          )}
        />
        <span className="flex-1">{summary}</span>
        {count === undefined ? null : <Badge tone="count">{count}</Badge>}
      </summary>
      <div className="border-t border-border px-3 py-3">{children}</div>
    </details>
  );
}
