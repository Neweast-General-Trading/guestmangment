"use client";

import { SearchSelect } from "@/components/search-select";
import { parkingSelectOptions } from "@/lib/parking";

export function ParkingSlotField({
  name = "parkingSlot",
  defaultValue = "",
  placeholder = "Search parking slot",
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <SearchSelect
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      options={[{ value: "", label: "No slot assigned" }, ...parkingSelectOptions(defaultValue)]}
    />
  );
}
