"use client";

import { useActionState, useMemo, useState } from "react";
import { saveVisitAction, walkInAction } from "@/app/actions";
import {
  ACCESS_AREAS,
  FORM_VISIT_TYPES,
  ID_TYPES,
  LOCATIONS,
  VISIT_TYPE_LABEL,
} from "@/lib/constants";
import { Button, ErrorText, Field, Select, TextInput, Textarea } from "@/components/ui";
import { SearchSelect } from "@/components/search-select";
import { ParkingSlotField } from "@/components/parking-slot-field";
import { HospitalityFields } from "@/components/hospitality-fields";
import { RoomSelect, type RoomOption } from "@/components/room-select";
import { defaultArrivalTime, todayStamp } from "@/lib/visit-schedule";
import { format } from "date-fns";
import type { FullVisit } from "@/lib/visits";
import type { GuestNeedDef } from "@/lib/guest-needs";

type Host = { id: string; name: string; departmentId: string | null; department?: { name: string } | null };
type Dept = { id: string; name: string };

const emptyVisitor = {
  fullName: "",
  mobile: "",
  email: "",
  nationality: "",
  company: "",
  jobTitle: "",
  visitorType: "CUSTOMER",
  idType: "NONE",
  idReference: "",
};

export function VisitForm({
  hosts,
  departments,
  visit,
  currentUserId,
  mode = "standard",
  catalog,
  rooms = [],
}: {
  hosts: Host[];
  departments: Dept[];
  visit?: FullVisit;
  currentUserId: string;
  mode?: "standard" | "walkin";
  catalog?: GuestNeedDef[];
  rooms?: RoomOption[];
}) {
  const action = mode === "walkin" ? walkInAction : saveVisitAction;
  const [state, formAction, pending] = useActionState(action, null);
  const initialVisitors = visit?.visitors.length
    ? visit.visitors.map((link) => ({
        fullName: link.visitor.fullName,
        mobile: link.visitor.mobile,
        email: link.visitor.email ?? "",
        nationality: link.visitor.nationality ?? "",
        company: link.visitor.company ?? "",
        jobTitle: link.visitor.jobTitle ?? "",
        visitorType: link.visitor.visitorType,
        idType: link.visitor.idType ?? "NONE",
        idReference: link.visitor.idReference && link.visitor.idReference !== "restricted" ? link.visitor.idReference : "",
      }))
    : [{ ...emptyVisitor }];
  const [visitors, setVisitors] = useState(initialVisitors);
  const [needsRoom, setNeedsRoom] = useState(Boolean(visit?.meetingRoom));
  const today = todayStamp();
  const [visitDay, setVisitDay] = useState(
    visit && format(visit.visitDate, "yyyy-MM-dd") >= today ? format(visit.visitDate, "yyyy-MM-dd") : today,
  );
  const [arrival, setArrival] = useState(visit ? format(visit.expectedArrival, "HH:mm") : defaultArrivalTime(visitDay));
  const timeMin = visitDay === today ? defaultArrivalTime(today) : undefined;
  const defaultHost = visit?.hostId ?? currentUserId;
  const hostOptions = useMemo(() => hosts, [hosts]);

  function changeVisitDay(next: string) {
    setVisitDay(next);
    const earliest = defaultArrivalTime(next);
    if (next === today && arrival < earliest) setArrival(earliest);
  }

  return (
    <form action={formAction} className="space-y-4">
      {visit ? <input type="hidden" name="visitId" value={visit.id} /> : null}
      <input type="hidden" name="visitorCount" value={visitors.length} />
      <ErrorText error={state?.error} />

      <section className="rounded-[10px] border border-[var(--line)] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">Visit</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Visit type" required>
            <Select name="type" defaultValue={visit?.type ?? (mode === "walkin" ? "CUSTOMER" : "CUSTOMER")}>
              {(mode === "walkin" ? (["WALK_IN", ...FORM_VISIT_TYPES] as const) : FORM_VISIT_TYPES).map((type) => (
                <option key={type} value={type}>
                  {VISIT_TYPE_LABEL[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Visit date" required>
            <TextInput
              type="date"
              name="visitDate"
              required
              min={today}
              value={visitDay}
              onChange={(event) => changeVisitDay(event.target.value)}
            />
          </Field>
          <Field label="Expected arrival" required>
            <TextInput
              type="time"
              name="expectedArrival"
              required
              min={timeMin}
              value={arrival}
              onChange={(event) => setArrival(event.target.value)}
            />
          </Field>
          <Field label="Expected departure">
            <TextInput
              type="time"
              name="expectedDeparture"
              defaultValue={visit?.expectedDeparture ? format(visit.expectedDeparture, "HH:mm") : "11:00"}
            />
          </Field>
          <Field label="Host employee" required>
            <SearchSelect
              name="hostId"
              required
              defaultValue={defaultHost}
              placeholder="Search employee name"
              options={hostOptions.map((host) => ({
                value: host.id,
                label: host.name,
                hint: host.department?.name ?? undefined,
              }))}
            />
          </Field>
          <Field label="Host department" required>
            <SearchSelect
              name="departmentId"
              required
              defaultValue={visit?.departmentId ?? hosts.find((h) => h.id === defaultHost)?.departmentId ?? departments[0]?.id}
              placeholder="Search department"
              options={departments.map((dept) => ({ value: dept.id, label: dept.name }))}
            />
          </Field>
          <Field label="Meeting location">
            <Select name="location" defaultValue={visit?.location ?? "Lobby / Reception"}>
              {LOCATIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label="Meeting room">
            <div className="flex gap-2">
              <button type="button" className={`chip ${needsRoom ? "on" : ""}`} onClick={() => setNeedsRoom(true)}>
                Yes
              </button>
              <button type="button" className={`chip ${needsRoom ? "" : "on"}`} onClick={() => setNeedsRoom(false)}>
                No
              </button>
            </div>
            {needsRoom ? (
              <div className="mt-2">
                <RoomSelect
                  defaultValue={visit?.meetingRoom && visit.meetingRoom !== "Yes" ? visit.meetingRoom : ""}
                  date={visitDay}
                  time={arrival}
                  required
                  rooms={rooms}
                />
              </div>
            ) : (
              <input type="hidden" name="meetingRoom" value="" />
            )}
          </Field>
          <Field label="Access area">
            <Select name="accessArea" defaultValue={visit?.accessArea ?? "General Offices"}>
              {ACCESS_AREAS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3 grid gap-3">
          <Field label="Purpose of visit" required>
            <TextInput
              name="purpose"
              required
              minLength={8}
              defaultValue={visit?.purpose}
              placeholder="Why is this visitor coming to Headquarters?"
            />
          </Field>
          <Field label="Detailed description">
            <Textarea name="description" defaultValue={visit?.description ?? ""} placeholder="Agenda, attendees, or additional context" />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-5 text-[13px]">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="parkingRequired" defaultChecked={visit?.parkingRequired} />
            Parking required
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="vip" defaultChecked={visit?.vip} />
            VIP / executive
          </label>
        </div>
      </section>

      {visitors.map((visitor, index) => (
        <section key={index} className="rounded-[10px] border border-[var(--line)] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">{index === 0 ? "Primary visitor" : `Accompanying visitor ${index}`}</h2>
            {index > 0 ? (
              <button
                type="button"
                className="text-[12px] text-[var(--muted)]"
                onClick={() => setVisitors((list) => list.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Full name" required>
              <TextInput name={`visitor_${index}_fullName`} required defaultValue={visitor.fullName} />
            </Field>
            <Field label="Mobile number" required>
              <TextInput name={`visitor_${index}_mobile`} required defaultValue={visitor.mobile} />
            </Field>
            <Field label="Email" required>
              <TextInput name={`visitor_${index}_email`} type="email" required defaultValue={visitor.email} />
            </Field>
            <Field label="Nationality">
              <TextInput name={`visitor_${index}_nationality`} defaultValue={visitor.nationality} />
            </Field>
            <Field label="Company / organization">
              <TextInput name={`visitor_${index}_company`} defaultValue={visitor.company} />
            </Field>
            <Field label="Job title">
              <TextInput name={`visitor_${index}_jobTitle`} defaultValue={visitor.jobTitle} />
            </Field>
            <Field label="Identification type">
              <Select name={`visitor_${index}_idType`} defaultValue={visitor.idType}>
                {ID_TYPES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Identification reference">
              <TextInput name={`visitor_${index}_idReference`} defaultValue={visitor.idReference} />
            </Field>
          </div>
        </section>
      ))}

      {mode === "standard" ? (
        <button
          type="button"
          className="text-[13px] text-[var(--muted)] hover:text-[var(--ink)]"
          onClick={() => setVisitors((list) => [...list, { ...emptyVisitor }])}
        >
          + Add accompanying visitor
        </button>
      ) : null}

      <section className="rounded-[10px] border border-[var(--line)] bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">Logistics & notes</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Vehicle plate">
            <TextInput name="vehiclePlate" defaultValue={visit?.vehicles[0]?.plate ?? ""} />
          </Field>
          <Field label="Vehicle type">
            <TextInput name="vehicleType" defaultValue={visit?.vehicles[0]?.vehicleType ?? ""} />
          </Field>
          <Field label="Parking slot">
            <ParkingSlotField defaultValue={visit?.vehicles[0]?.parkingSlot ?? ""} />
          </Field>
          <Field label="Special requirements">
            <TextInput name="specialRequirements" defaultValue={visit?.specialRequirements ?? ""} />
          </Field>
          <Field label="Internal notes">
            <TextInput name="internalNotes" defaultValue={visit?.internalNotes ?? ""} />
          </Field>
        </div>
      </section>

      {mode === "standard" ? <HospitalityFields visit={visit} catalog={catalog} /> : null}

      <div className="flex flex-wrap gap-2">
        {mode === "walkin" ? (
          <Button type="submit" className={pending ? "opacity-60" : ""}>
            {pending ? "Saving…" : "Register walk-in and request approval"}
          </Button>
        ) : (
          <>
            <button
              name="intent"
              value="draft"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg border border-[var(--line-strong)] bg-white px-3 text-[13px] font-medium disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save draft"}
            </button>
            <button
              name="intent"
              value="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-[13px] font-medium text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Submit for approval"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
