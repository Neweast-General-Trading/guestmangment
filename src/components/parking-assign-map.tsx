"use client";

import { useMemo, useState } from "react";
import { assignStaffParkingAction, releaseStaffParkingAction } from "@/app/actions";
import { FormBusy } from "@/components/form-busy";
import { SearchSelect, type SearchOption } from "@/components/search-select";
import { Button, Card, Field, TextInput, inputClass } from "@/components/ui";
import { PARKING_VEHICLE_TYPES, parkingMapLayout, parkingSlotMeta, plateListLabel, type ParkingVehicle } from "@/lib/parking";

export type ParkingBay = {
  slot: string;
  userId: string;
  name: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  assignedBy: string;
  vehicles: ParkingVehicle[];
};

const ZONE_TONE: Record<string, string> = {
  A: "border-[#ead8d8] bg-[var(--tint-mint)]",
  B: "border-[#ebe3cf] bg-[var(--tint-sand)]",
  C: "border-[#d7e6da] bg-[var(--tint-sage)]",
  D: "border-[#d6e2ee] bg-[var(--tint-sky)]",
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function VehicleRows({ initial }: { initial: ParkingVehicle[] }) {
  const [rows, setRows] = useState<ParkingVehicle[]>(initial.length ? initial : [{ plate: "", vehicleType: null }]);

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <Field label={index === 0 ? "Vehicle plate" : `Plate ${index + 1}`} required={index === 0}>
            <TextInput
              name="plate"
              required={index === 0}
              value={row.plate}
              onChange={(event) => setRows(rows.map((item, current) => (current === index ? { ...item, plate: event.target.value } : item)))}
              placeholder="Plate number"
              autoComplete="off"
            />
          </Field>
          <Field label={index === 0 ? "Vehicle type" : "Type"}>
            <select
              name="vehicleType"
              className={inputClass}
              value={row.vehicleType || ""}
              onChange={(event) =>
                setRows(rows.map((item, current) => (current === index ? { ...item, vehicleType: event.target.value || null } : item)))
              }
            >
              <option value="">Optional</option>
              {PARKING_VEHICLE_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          {rows.length > 1 ? (
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, current) => current !== index))}
              className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium hover:bg-[#faf7f7]"
            >
              Remove
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
        </div>
      ))}
      {rows.length < 8 ? (
        <button
          type="button"
          onClick={() => setRows([...rows, { plate: "", vehicleType: null }])}
          className="text-[12px] font-medium text-[var(--brand-ink)] hover:underline"
        >
          Add another car
        </button>
      ) : null}
    </div>
  );
}

export function ParkingAssignMap({
  employees,
  assignments,
}: {
  employees: SearchOption[];
  assignments: ParkingBay[];
}) {
  const layout = useMemo(() => parkingMapLayout(), []);
  const bySlot = useMemo(() => new Map(assignments.map((row) => [row.slot, row])), [assignments]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const selectedBay = selected ? bySlot.get(selected) : undefined;
  const selectedMeta = selected ? parkingSlotMeta(selected) : null;
  const needle = query.trim().toLowerCase();
  const matchSlots = needle
    ? new Set(
        assignments
          .filter((row) => `${row.slot} ${row.name} ${row.email} ${plateListLabel(row.vehicles)} ${row.vehicles.map((item) => item.vehicleType || "").join(" ")} ${row.department || ""}`.toLowerCase().includes(needle))
          .map((row) => row.slot)
          .concat(layout.flatMap((zone) => zone.sections.flatMap((section) => section.slots)).filter((slot) => slot.toLowerCase().includes(needle))),
      )
    : null;

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">Find a bay or employee</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A31, B43, or a name"
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-[13px] outline-none focus:border-[var(--brand)]"
          />
        </label>
        <div className="flex flex-wrap gap-3 text-[12px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-sm border border-dashed border-[var(--line-strong)] bg-white" />
            Free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-sm border border-[var(--brand)] bg-[var(--brand-soft)]" />
            Reserved
          </span>
          <span>{assignments.length} reserved · {72 - assignments.length} free</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {layout.map((zone) => {
          const reserved = zone.sections.reduce((sum, section) => sum + section.slots.filter((slot) => bySlot.has(slot)).length, 0);
          return (
            <section key={zone.zone} className={`overflow-hidden rounded-3xl border ${ZONE_TONE[zone.zone]}`}>
              <header className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--faint)]">Parking zone</div>
                  <h2 className="text-[22px] font-medium tracking-tight">Zone {zone.zone}</h2>
                </div>
                <div className="rounded-full border border-[var(--line)] bg-white/80 px-2.5 py-1 text-[12px] text-[var(--muted)]">
                  {reserved}/18 reserved
                </div>
              </header>
              <div className="space-y-3 px-3 pb-4">
                {zone.sections.map((section, index) => (
                  <div key={section.section}>
                    <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">
                      <span>
                        {section.label} · {section.from}–{section.to}
                      </span>
                      <span>9 bays</span>
                    </div>
                    <div className="rounded-2xl bg-[#2c2727] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-9">
                        {section.slots.map((slot) => {
                          const bay = bySlot.get(slot);
                          const active = selected === slot;
                          const dim = matchSlots ? !matchSlots.has(slot) : false;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelected(slot)}
                              className={`min-h-[72px] rounded-lg border px-1.5 py-1.5 text-left transition ${
                                bay
                                  ? "border-[#e4b4b4] bg-[var(--brand-soft)] text-[var(--brand-ink)]"
                                  : "border-[#5a5252] bg-[#3a3434] text-white"
                              } ${active ? "ring-2 ring-[var(--brand)] ring-offset-1 ring-offset-[#2c2727]" : ""} ${
                                dim ? "opacity-30" : ""
                              }`}
                            >
                              <div className="font-mono text-[11px] font-medium tracking-wide">{slot}</div>
                              <div className="mt-1 truncate text-[11px] leading-tight">
                                {bay ? firstName(bay.name) : "Open"}
                              </div>
                              {bay?.vehicles.length ? (
                                <div className="mt-0.5 truncate font-mono text-[10px] opacity-80">
                                  {bay.vehicles[0].plate}
                                  {bay.vehicles.length > 1 ? ` +${bay.vehicles.length - 1}` : ""}
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {index === 0 ? (
                      <div className="mx-6 my-2 h-2 rounded-full bg-[#4a4444]" aria-hidden="true" />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {selected && selectedMeta ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(26,21,21,0.42)] p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
          <Card tone="plain">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--faint)]">
                Zone {selectedMeta.zone} · Section {selectedMeta.section}
              </div>
              <h3 className="mt-1 text-lg font-medium">Bay {selected}</h3>
              {selectedBay ? (
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  Reserved for {selectedBay.name}
                  {selectedBay.department ? ` · ${selectedBay.department}` : ""}
                  {selectedBay.jobTitle ? ` · ${selectedBay.jobTitle}` : ""}
                  . {selectedBay.vehicles.length ? `Plates ${plateListLabel(selectedBay.vehicles)}` : "Plate not set"}
                  . Assigned by {selectedBay.assignedBy}.
                </p>
              ) : (
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  Choose an employee to reserve parking number {selectedMeta.number} in Zone {selectedMeta.zone}.
                  They will get a Teams notice from Human Resources.
                </p>
              )}
              <form action={assignStaffParkingAction} className="mt-4 space-y-3">
                <FormBusy label="Reserving bay…" />
                <input type="hidden" name="slot" value={selected} />
                <SearchSelect
                  name="userId"
                  options={employees}
                  defaultValue={selectedBay?.userId || ""}
                  placeholder="Search employee"
                  required
                />
                <VehicleRows key={selected} initial={selectedBay?.vehicles || []} />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">{selectedBay ? "Reassign bay" : "Reserve bay"}</Button>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium hover:bg-[#faf7f7]"
                  >
                    Close
                  </button>
                </div>
              </form>
              {selectedBay ? (
                <form action={releaseStaffParkingAction} className="mt-3">
                  <FormBusy label="Releasing bay…" />
                  <input type="hidden" name="slot" value={selected} />
                  <Button type="submit" variant="danger">
                    Release bay
                  </Button>
                </form>
              ) : null}
            </div>
          </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
