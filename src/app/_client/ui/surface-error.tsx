import { TriangleAlert } from "lucide-react";
import type { ReactElement } from "react";

import { Card } from "./card";

/**
 * A failure the user cannot retry their way out of, shown in place of the thing
 * that failed.
 *
 * @remarks
 * No `role="alert"`: this is not an interruption to announce over the page, it
 * *is* the page's content at that point, and a heading plus normal reading
 * order carries it.
 */
export function SurfaceError({
  heading,
  children,
}: Readonly<{ heading: string; children: string }>): ReactElement {
  return (
    <Card className="border-danger/50 bg-danger-subtle">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-text">
        <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-danger" />
        {heading}
      </h3>
      <p className="mt-2 text-base text-text">{children}</p>
    </Card>
  );
}
