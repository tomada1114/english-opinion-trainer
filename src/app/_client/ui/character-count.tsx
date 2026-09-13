import type { ReactElement } from "react";

import { cn } from "./cn";

/** Above this share of the ceiling the count changes appearance and is announced once. */
const NEAR_LIMIT_SHARE = 0.9;

/** Whether `count` has reached the share of `max` that counts as near the limit. */
export function isNearLimit(count: number, max: number): boolean {
  return count >= max * NEAR_LIMIT_SHARE;
}

/**
 * The character count for a field, against that field's own ceiling.
 *
 * @remarks
 * Deliberately **not** wired into the field's `aria-describedby`: a description
 * that changes on every keystroke is re-read on every keystroke, which makes
 * composing a sentence impossible. The ceiling is described statically instead,
 * and only crossing {@link NEAR_LIMIT_SHARE} is announced — once, by the
 * `role="status"` this renders when `near` is true.
 */
export function CharacterCount({
  label,
  near,
}: Readonly<{ label: string; near: boolean }>): ReactElement {
  return (
    <p
      {...(near ? { role: "status" } : {})}
      className={cn("text-sm tabular-nums", near ? "text-warning" : "text-text-subtle")}
    >
      {label}
    </p>
  );
}
