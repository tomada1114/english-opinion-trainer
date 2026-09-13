import { ArrowRight } from "lucide-react";
import type { ReactElement } from "react";

/**
 * One `before → after — why` row, shared by the fixes and the grammar notes.
 *
 * @remarks
 * `text-decoration` is set explicitly rather than left to the user agent's
 * default for `<del>`/`<ins>`: the underline an `<ins>` gets by default reads as
 * a link on a dark ground, and the strike on `<del>` is the only cue that
 * survives greyscale, so neither is left to chance. The arrow is decorative —
 * the element order and the strike already say which half is which.
 */
export function DiffLine({
  before,
  after,
  why,
}: Readonly<{ before: string; after: string; why: string }>): ReactElement {
  return (
    <li className="border-t border-border py-2 first:border-t-0 first:pt-0">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base">
        <del
          data-plain-text
          className="text-text-muted decoration-danger line-through decoration-2"
        >
          {before}
        </del>
        <ArrowRight
          aria-hidden="true"
          className="size-4 shrink-0 self-center text-text-subtle"
        />
        <ins data-plain-text className="font-medium text-text no-underline">
          {after}
        </ins>
      </p>
      <p className="mt-1 text-sm text-text-muted">{why}</p>
    </li>
  );
}
