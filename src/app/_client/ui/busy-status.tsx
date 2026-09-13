import type { ReactElement } from "react";

import { cn } from "./cn";

const DOT_DELAYS = ["0ms", "200ms", "400ms"] as const;

/**
 * The narrated wait: what is happening, said rather than merely implied.
 *
 * @remarks
 * `role="status"` makes this the one polite announcement for a request
 * starting, so the caller does not need a second live region. The dots are
 * decoration on top of the sentence and are hidden from assistive technology;
 * under `prefers-reduced-motion` the animation stops and they stay as three
 * static dots, because the sentence already carried the information.
 */
export function BusyStatus({ label }: Readonly<{ label: string }>): ReactElement {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-text-muted">
      <span className="flex items-center gap-1" aria-hidden="true">
        {DOT_DELAYS.map((delay) => (
          <span
            key={delay}
            style={{ animationDelay: delay }}
            className={cn(
              "size-1.5 rounded-full bg-primary",
              "animate-pulse-dot motion-reduce:animate-none motion-reduce:opacity-60",
            )}
          />
        ))}
      </span>
      {label}
    </p>
  );
}
