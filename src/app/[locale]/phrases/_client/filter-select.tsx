"use client";

import { type ReactElement, useId } from "react";

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
    <p>
      <label htmlFor={id}>{label}</label>{" "}
      <select
        id={id}
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
      </select>
    </p>
  );
}
