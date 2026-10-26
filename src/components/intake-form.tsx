"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  confirmIntakeAction,
  escalateIntakeAction,
  saveIntakeAction,
  submitIntakeAction,
} from "@/app/actions";
import { SearchSelect } from "@/components/search-select";
import { RoomSelect, type RoomOption } from "@/components/room-select";
import { FormBusy } from "@/components/form-busy";
import { Button, Field, TextInput, Textarea, inputClass } from "@/components/ui";
import { GUEST_KINDS } from "@/lib/constants";
import { emptyVisitor, type ParsedVisitor } from "@/lib/email-template";

export type IntakeFormVisit = {
  id: string;
  purpose: string;
  visitDate: string;
  expectedArrival: string;
  departmentId: string;
  hostId: string;
  guestKind: string;
  meetingRoom: string;
  driverRequired: boolean;
  driverName: string;
  driverMobile: string;
  driverVehicle: string;
  visitors: ParsedVisitor[];
  canEscalate: boolean;
  locked: boolean;
};

export function IntakeForm({
  visit,
  hosts,
  departments,
  rooms = [],
}: {
  visit: IntakeFormVisit;
  hosts: { value: string; label: string; hint?: string }[];
  departments: { value: string; label: string }[];
  rooms?: RoomOption[];
}) {
  const [driverRequired, setDriverRequired] = useState(visit.driverRequired);
  const [visitDate, setVisitDate] = useState(visit.visitDate);
  const [arrival, setArrival] = useState(visit.expectedArrival);
  const [visitors, setVisitors] = useState(
    visit.visitors.length ? visit.visitors : [emptyVisitor()],
  );

  return (
    <form className="space-y-5">
      <FormBusy label="Updating request…" />
      <input type="hidden" name="visitId" value={visit.id} />
      <input type="hidden" name="visitorCount" value={visitors.length} />

      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 className="text-sm font-semibold">Request</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">Administration can correct anything the email missed.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Visit date" required>
            <TextInput type="date" name="visitDate" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} required disabled={visit.locked} />
          </Field>
          <Field label="Arrival time" required>
            <TextInput type="time" name="expectedArrival" value={arrival} onChange={(event) => setArrival(event.target.value)} required disabled={visit.locked} />
          </Field>
          <Field label="Department" required>
            <SearchSelect name="departmentId" options={departments} defaultValue={visit.departmentId} required />
          </Field>
          <Field label="Host">
            <SearchSelect name="hostId" options={hosts} defaultValue={visit.hostId} placeholder="Search host…" />
          </Field>
          <Field label="Guest type" required>
            <select name="guestKind" defaultValue={visit.guestKind} className={inputClass} disabled={visit.locked}>
              {GUEST_KINDS.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Meeting room" required>
            <RoomSelect defaultValue={visit.meetingRoom} date={visitDate} time={arrival} disabled={visit.locked} required rooms={rooms} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Purpose" required>
            <Textarea name="purpose" defaultValue={visit.purpose} required disabled={visit.locked} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Visitors</h2>
            <p className="mt-1 text-[12px] text-[var(--muted)]">{visitors.length} {visitors.length === 1 ? "person" : "people"}</p>
          </div>
          {visit.locked ? null : (
            <button
              type="button"
              className="h-8 rounded-md border border-[var(--line)] px-3 text-[12px]"
              onClick={() => setVisitors((rows) => [...rows, emptyVisitor()])}
            >
              Add visitor
            </button>
          )}
        </div>
        <div className="mt-4 space-y-4">
          {visitors.map((visitor, index) => (
            <div key={index} className="rounded-xl border border-[var(--line)] bg-[#fcfafa] p-4">
              <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--faint)]">
                Visitor {index + 1}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput name={`visitor_${index}_fullName`} placeholder="Full name" defaultValue={visitor.fullName} required disabled={visit.locked} />
                <TextInput name={`visitor_${index}_mobile`} placeholder="Mobile" defaultValue={visitor.mobile} required disabled={visit.locked} />
                <TextInput name={`visitor_${index}_email`} placeholder="Email" defaultValue={visitor.email} disabled={visit.locked} />
                <TextInput name={`visitor_${index}_company`} placeholder="Company" defaultValue={visitor.company} disabled={visit.locked} />
                <TextInput name={`visitor_${index}_jobTitle`} placeholder="Job title" defaultValue={visitor.jobTitle} disabled={visit.locked} />
                <TextInput name={`visitor_${index}_nationality`} placeholder="Nationality" defaultValue={visitor.nationality} disabled={visit.locked} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 className="text-sm font-semibold">Driver</h2>
        <label className="mt-3 flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            name="driverRequired"
            checked={driverRequired}
            disabled={visit.locked}
            onChange={(event) => setDriverRequired(event.target.checked)}
          />
          Driver required
        </label>
        {driverRequired ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <TextInput name="driverName" placeholder="Driver name" defaultValue={visit.driverName} disabled={visit.locked} />
            <TextInput name="driverMobile" placeholder="Driver mobile" defaultValue={visit.driverMobile} disabled={visit.locked} />
            <TextInput name="driverVehicle" placeholder="Vehicle" defaultValue={visit.driverVehicle} disabled={visit.locked} />
          </div>
        ) : null}
      </section>

      {visit.locked ? null : (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <h2 className="text-sm font-semibold">Actions</h2>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            Confirm sets the room and driver. Submit sends the visit to the security desk. Customer requests can go to Samir first.
          </p>
          {visit.canEscalate ? (
            <div className="mt-3">
              <Textarea name="escalationNotes" placeholder="Note for Samir (optional)" />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <IntakeAction label="Save" working="Saving…" variant="secondary" formAction={saveIntakeAction} />
            <IntakeAction label="Confirm" working="Confirming…" formAction={confirmIntakeAction} />
            {visit.canEscalate ? (
              <IntakeAction label="Escalation" working="Sending…" variant="secondary" formAction={escalateIntakeAction} />
            ) : null}
            <IntakeAction label="Submit to Security" working="Submitting…" formAction={submitIntakeAction} />
          </div>
        </section>
      )}
    </form>
  );
}

function IntakeAction({
  label,
  working,
  variant = "primary",
  formAction,
}: {
  label: string;
  working: string;
  variant?: "primary" | "secondary";
  formAction: React.ComponentProps<"button">["formAction"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} formAction={formAction} disabled={pending}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {working}
        </span>
      ) : (
        label
      )}
    </Button>
  );
}
