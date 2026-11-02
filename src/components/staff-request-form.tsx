"use client";

import { useState } from "react";
import { submitStaffRequestAction, updateStaffRequestAction } from "@/app/actions";
import { FormBusy } from "@/components/form-busy";
import { SearchSelect, type SearchOption } from "@/components/search-select";
import { GIFT_TYPES } from "@/lib/arrangement-types";
import { InvitePeople } from "@/components/invite-people";
import { RoomSelect } from "@/components/room-select";
import { TourField } from "@/components/tour-field";
import { GuestDocFields } from "@/components/guest-doc-fields";
import { Button, Field, TextInput, Textarea, inputClass } from "@/components/ui";
import type { GuestDocType } from "@/lib/guest-doc-types";

const EMPTY = { fullName: "", mobile: "", email: "", company: "", jobTitle: "", nationality: "" };

export type StaffRequestEdit = {
  id: string;
  visitDate: string;
  arrivalTime: string;
  departmentId: string;
  guestKind: string;
  tourType: string;
  meetingRoom: string;
  purpose: string;
  driverRequired: boolean;
  gatePassRequired: boolean;
  giftRequired: boolean;
  giftType: string;
  guests: typeof EMPTY[];
  invitees: { email: string; name: string }[];
  docs?: { type: GuestDocType; name: string; href: string }[];
};

export function StaffRequestForm({
  departments,
  departmentId,
  today,
  people,
  bookerEmail,
  edit,
}: {
  departments: SearchOption[];
  departmentId: string;
  today: string;
  people: { value: string; label: string; hint?: string }[];
  bookerEmail: string;
  edit?: StaffRequestEdit | null;
}) {
  const knownGift = GIFT_TYPES.includes((edit?.giftType || "") as (typeof GIFT_TYPES)[number]);
  const [rows, setRows] = useState(edit?.guests.length ? edit.guests.map((row) => ({ ...EMPTY, ...row })) : [{ ...EMPTY }]);
  const [guestCount, setGuestCount] = useState(edit?.guests.length || 1);
  const [giftRequired, setGiftRequired] = useState(edit?.giftRequired ? "yes" : "no");
  const [giftType, setGiftType] = useState<(typeof GIFT_TYPES)[number]>(knownGift ? (edit?.giftType as (typeof GIFT_TYPES)[number]) : "Other");
  const [visitDate, setVisitDate] = useState(edit?.visitDate || today);
  const [arrivalTime, setArrivalTime] = useState(edit?.arrivalTime || "10:00");

  function resizeGuests(raw: number) {
    const count = Math.min(12, Math.max(1, Number.isFinite(raw) ? raw : 1));
    setGuestCount(count);
    setRows((current) => {
      const next = current.slice(0, count).map((row) => ({ ...row }));
      while (next.length < count) next.push({ ...EMPTY });
      return next;
    });
  }

  return (
    <form action={edit ? updateStaffRequestAction : submitStaffRequestAction} encType="multipart/form-data" className="space-y-5">
      <FormBusy label={edit ? "Saving changes…" : "Sending request…"} />
      {edit ? <input type="hidden" name="visitId" value={edit.id} /> : null}
      <input type="hidden" name="visitorRows" value={rows.length} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Visit date" required>
          <TextInput name="visitDate" type="date" min={edit && edit.visitDate < today ? edit.visitDate : today} required value={visitDate} onChange={(event) => setVisitDate(event.target.value)} />
        </Field>
        <Field label="Arrival time" required>
          <TextInput name="arrivalTime" type="time" required value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Department" required>
          <SearchSelect name="departmentId" options={departments} defaultValue={edit?.departmentId || departmentId} placeholder="Department" required />
        </Field>
        <Field label="Guest type" required>
          <select name="guestKind" className={inputClass} defaultValue={edit?.guestKind || "GUEST"} required>
            <option value="GUEST">Guest</option>
            <option value="CUSTOMER">Customer</option>
            <option value="SUPPLIER">Supplier</option>
            <option value="VIP">VIP</option>
          </select>
        </Field>
        <TourField defaultValue={edit?.tourType} />
        <Field label="Proposed room">
          <RoomSelect
            name="meetingRoom"
            date={visitDate}
            time={arrivalTime}
            allowNone
            defaultValue={edit?.meetingRoom || "N/A"}
            keepBooked={edit && visitDate === edit.visitDate && arrivalTime === edit.arrivalTime ? edit.meetingRoom : ""}
          />
          <p className="mt-1 text-[12px] text-[var(--muted)]">Choose N/A and reception will assign the room.</p>
        </Field>
      </div>
      <Field label="Purpose" required>
        <Textarea name="purpose" required defaultValue={edit?.purpose || ""} placeholder="Why they are coming" className="min-h-20" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Driver and car">
          <select name="driverRequired" className={inputClass} defaultValue={edit?.driverRequired ? "yes" : "no"}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <Field label="Required gate pass">
          <select name="gatePassRequired" className={inputClass} defaultValue={edit?.gatePassRequired ? "yes" : "no"}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <Field label="Protocol gift">
          <select
            name="giftRequired"
            className={inputClass}
            value={giftRequired}
            onChange={(event) => setGiftRequired(event.target.value)}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
      </div>
      {giftRequired === "yes" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Gift type" required>
            <select
              name="giftType"
              className={inputClass}
              value={giftType}
              onChange={(event) => setGiftType(event.target.value as (typeof GIFT_TYPES)[number])}
              required
            >
              {GIFT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          {giftType === "Other" ? (
            <Field label="Describe the gift" required>
              <TextInput name="giftTypeOther" required defaultValue={knownGift ? "" : edit?.giftType || ""} placeholder="What should we prepare?" />
            </Field>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold">Guests</h2>
          <Field label="Number of guests" required>
            <TextInput
              name="guestCount"
              type="number"
              min={1}
              max={12}
              required
              value={String(guestCount)}
              onChange={(event) => resizeGuests(Number(event.target.value))}
            />
          </Field>
        </div>
        {rows.map((row, index) => (
          <div key={index} className="rounded-2xl border border-[var(--line)] bg-[#fcfafa] p-3">
            <div className="mb-2 text-[12px] text-[var(--muted)]">
              <span>Guest {index + 1} of {guestCount}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Full name" required>
                <TextInput name={`fullName_${index}`} placeholder="Full name" required defaultValue={row.fullName} />
              </Field>
              <Field label="Mobile">
                <TextInput name={`mobile_${index}`} placeholder="Optional" defaultValue={row.mobile} />
              </Field>
              <Field label="Email">
                <TextInput name={`email_${index}`} type="email" placeholder="Optional" defaultValue={row.email} />
              </Field>
              <TextInput name={`company_${index}`} placeholder="Company" defaultValue={row.company} />
              <TextInput name={`jobTitle_${index}`} placeholder="Job title" defaultValue={row.jobTitle} />
              <TextInput name={`nationality_${index}`} placeholder="Nationality" defaultValue={row.nationality} />
            </div>
          </div>
        ))}
      </div>

      <GuestDocFields docs={edit?.docs || []} />

      <InvitePeople
        people={people}
        bookerEmail={bookerEmail}
        initial={edit?.invitees || []}
        hint="NEWEAST colleagues to invite. After the room confirms, they receive the meeting invitation together with the requester and the administration contact for this visit. Guests are not invited."
      />

      <Button type="submit">{edit ? "Save changes" : "Submit request"}</Button>
    </form>
  );
}
