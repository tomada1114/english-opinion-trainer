"use client";

import { type ReactElement, useId } from "react";

import { Label } from "../../../_client/ui/label";
import { Select } from "../../../_client/ui/select";

export interface FilterOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** A labeled select that only accepts values from its declared options. */
export function FilterSelect<T extends string>({
  label,
  allLabel,
  options,
  value,
  onChange,
}: Readonly<{
  label: string;
  allLabel: string;
  options: readonly FilterOption<T>[];
  value: T | "";
  onChange: (value: T | "") => void;
}>): ReactElement {
  const id = useId();

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        className="w-full"
        value={value}
        onChange={(event) => {
          const selected = options.find(
            (option) => option.value === event.currentTarget.value,
          );
          onChange(selected?.value ?? "");
        }}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
