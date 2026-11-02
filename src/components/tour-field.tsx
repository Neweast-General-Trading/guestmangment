"use client";

import { Field, inputClass } from "@/components/ui";
import { TOUR_TYPES, parseTourType } from "@/lib/constants";

export function TourField({
  defaultValue = "NONE",
  name = "tourType",
}: {
  defaultValue?: string | null;
  name?: string;
}) {
  return (
    <Field label="HQ tour">
      <select name={name} className={inputClass} defaultValue={parseTourType(defaultValue)}>
        {TOUR_TYPES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
