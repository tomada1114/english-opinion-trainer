import type { ComponentProps, ReactElement } from "react";

import { cn } from "./cn";

/** A horizontal rule. `<hr>` already carries the separator role. */
export function Separator({ className, ...props }: ComponentProps<"hr">): ReactElement {
  return <hr className={cn("border-0 border-t border-border", className)} {...props} />;
}
