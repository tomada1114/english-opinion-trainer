import { CircleAlert } from "lucide-react";
import type { ReactElement } from "react";

/**
 * A message about the thing right next to it.
 *
 * @remarks
 * `role="alert"` because it always follows an action the user just took, and
 * the icon is there so the message does not depend on the danger colour — under
 * greyscale or forced colours the hue is gone but the glyph is not.
 */
export function InlineError({
  children,
}: Readonly<{ children: string }>): ReactElement {
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-danger">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
