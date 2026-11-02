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

const EMPTY = {
  fullName: "",
  mobile: "",
  email: "",
  company: "",
  jobTitle: "",
  nationality: "",
  gatePassRequired: false,
  giftRequired: false,
  giftType: "Welcome gift",
  docs: [] as { type: GuestDocType; name: string; href: string }[],
};

export type StaffRequestEdit = {
  id: string;
  visitDate: string;
  arrivalTime: string;
  endTime: string;
  departmentId: string;
  guestKind: string;
  tourType: string;
  meetingRoom: string;
  visitTitle: string;
  purpose: string;
  driverRequired: boolean;
  guests: typeof EMPTY[];
  invitees: { email: string; name: string }[];
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
  const [rows, setRows] = useState(edit?.guests.length ? edit.guests.map((row) => ({ ...EMPTY, ...row })) : [{ ...EMPTY }]);
  const [guestCount, setGuestCount] = useState(edit?.guests.length || 1);
  const [visitDate, setVisitDate] = useState(edit?.visitDate || today);
  const [arrivalTime, setArrivalTime] = useState(edit?.arrivalTime || "10:00");
  const [endTime, setEndTime] = useState(edit?.endTime || "11:00");

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
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Visit date" required>
          <TextInput name="visitDate" type="date" min={edit && edit.visitDate < today ? edit.visitDate : today} required value={visitDate} onChange={(event) => setVisitDate(event.target.value)} />
        </Field>
        <Field label="Arrival time" required>
          <TextInput name="arrivalTime" type="time" required value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} />
        </Field>
        <Field label="Expected end" required>
          <TextInput name="endTime" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} />
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
            keepBooked={edit && visitDate === edit.visitDate && arrivalTime === edit.arrivalTime && endTime === edit.endTime ? edit.meetingRoom : ""}
          />
          <p className="mt-1 text-[12px] text-[var(--muted)]">Choose N/A and reception will assign the room.</p>
        </Field>
      </div>
      <Field label="Title of visit" required>
        <TextInput name="visitTitle" required defaultValue={edit?.visitTitle || ""} placeholder="Title shown on the invitation" />
      </Field>
      <Field label="Visit details">
        <Textarea name="purpose" defaultValue={edit?.purpose || ""} placeholder="Optional" className="min-h-20" />
      </Field>
      <Field label="Driver and car">
        <select name="driverRequired" className={inputClass} defaultValue={edit?.driverRequired ? "yes" : "no"}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>

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
            <GuestChoices index={index} gatePassRequired={row.gatePassRequired} giftRequired={row.giftRequired} giftType={row.giftType} />
            <div className="mt-3">
              <GuestDocFields index={index} guestName={row.fullName || `Guest ${index + 1}`} docs={row.docs} />
            </div>
          </div>
        ))}
      </div>

      <InvitePeople
        people={people}
        bookerEmail={bookerEmail}
        initial={edit?.invitees || []}
        hint="NEWEAST and AISIN colleagues to invite. When Reception confirms the booking, they receive a guest visit invitation they can accept. Guests are not included."
      />

      <Button type="submit">{edit ? "Save changes" : "Submit request"}</Button>
    </form>
  );
}

function GuestChoices({
  index,
  gatePassRequired,
  giftRequired,
  giftType,
}: {
  index: number;
  gatePassRequired: boolean;
  giftRequired: boolean;
  giftType: string;
}) {
  const known = GIFT_TYPES.includes(giftType as (typeof GIFT_TYPES)[number]);
  const [pass, setPass] = useState(gatePassRequired ? "yes" : "no");
  const [gift, setGift] = useState(giftRequired ? "yes" : "no");
  const [type, setType] = useState<(typeof GIFT_TYPES)[number]>(known ? (giftType as (typeof GIFT_TYPES)[number]) : "Other");
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <Field label="Gate pass">
        <select name={`gatePass_${index}`} className={inputClass} value={pass} onChange={(event) => setPass(event.target.value)}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>
      <Field label="Protocol gift">
        <select name={`gift_${index}`} className={inputClass} value={gift} onChange={(event) => setGift(event.target.value)}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>
      {gift === "yes" ? (
        <Field label="Gift type" required>
          <select name={`giftType_${index}`} className={inputClass} value={type} onChange={(event) => setType(event.target.value as (typeof GIFT_TYPES)[number])} required>
            {GIFT_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {gift === "yes" && type === "Other" ? (
        <Field label="Describe the gift" required>
          <TextInput name={`giftTypeOther_${index}`} required defaultValue={known ? "" : giftType} placeholder="What should we prepare?" />
        </Field>
      ) : null}
    </div>
  );
}
