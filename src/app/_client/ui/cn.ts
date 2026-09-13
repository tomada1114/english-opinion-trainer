import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and lets a later Tailwind utility win over an earlier one.
 *
 * @remarks
 * `clsx` alone would keep both `p-2` and `p-4` in the attribute, leaving the
 * winner to source order inside the generated stylesheet rather than to the
 * caller. `twMerge` drops the earlier of two utilities from the same group, so
 * a `className` prop can override a component's own default.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
