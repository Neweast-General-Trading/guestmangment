"use client";

import Link from "next/link";
import { saveGuestServiceAction } from "@/app/actions";
import { NEED_CATEGORIES } from "@/lib/guest-needs";
import { Button, Field, Select, TextInput, Textarea } from "@/components/ui";
import { SearchChecks } from "@/components/search-select";

const MAPS = [
  { code: "", label: "None" },
  { code: "hotel", label: "Hotel details" },
  { code: "pickup", label: "Pickup / wait" },
  { code: "dropoff", label: "Drop-off" },
  { code: "breakfast", label: "Breakfast" },
  { code: "lunch", label: "Lunch" },
  { code: "dinner", label: "Dinner" },
  { code: "parking", label: "Parking" },
];

type Service = {
  id?: string;
  code?: string;
  label?: string;
  hint?: string;
  description?: string | null;
  category?: string;
  maps?: string | null;
  active?: boolean;
  owners?: { userId: string }[];
};

export function ServiceMasterForm({
  service,
  users,
}: {
  service?: Service;
  users: { id: string; name: string; email: string; jobTitle: string | null }[];
}) {
  const selected = new Set(service?.owners?.map((item) => item.userId) ?? []);
  return (
    <form action={saveGuestServiceAction} className="space-y-4 rounded-[10px] border border-[var(--line)] bg-white p-4">
      {service?.id ? <input type="hidden" name="id" value={service.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name" required>
          <TextInput name="label" required defaultValue={service?.label ?? ""} placeholder="Flight ticket" />
        </Field>
        {!service?.id ? (
          <Field label="Code (optional)">
            <TextInput name="code" placeholder="FLIGHT_TICKET" />
          </Field>
        ) : (
          <Field label="Code">
            <div className="flex h-9 items-center rounded-lg border border-[var(--line)] bg-[#faf7f7] px-3 text-[13px] text-[var(--muted)]">
              {service.code}
            </div>
          </Field>
        )}
        <Field label="Short hint">
          <TextInput name="hint" defaultValue={service?.hint ?? ""} placeholder="Arrange flights" />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue={service?.category ?? "other"}>
            {NEED_CATEGORIES.filter((item) => item.code !== "all").map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Extra fields">
          <Select name="maps" defaultValue={service?.maps ?? ""}>
            {MAPS.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description">
        <Textarea name="description" defaultValue={service?.description ?? ""} placeholder="What this service covers and how it should be prepared." />
      </Field>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="active" defaultChecked={service?.active !== false} />
        Active in the visit catalogue
      </label>
      <div>
        <div className="mb-2 text-[12px] font-medium text-[var(--muted)]">Responsible people</div>
        <SearchChecks
          name="ownerId"
          defaultSelected={[...selected]}
          placeholder="Search people"
          options={users.map((user) => ({ value: user.id, label: user.name, hint: user.jobTitle || user.email }))}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">{service?.id ? "Save service" : "Add service"}</Button>
        <Link href="/master/services" className="inline-flex h-8 items-center px-3 text-[12px] text-[var(--muted)]">
          Cancel
        </Link>
      </div>
    </form>
  );
}
