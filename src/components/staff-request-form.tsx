"use client";

import { useState } from "react";
import { submitStaffRequestAction } from "@/app/actions";
import { FormBusy } from "@/components/form-busy";
import { SearchSelect, type SearchOption } from "@/components/search-select";
import { GIFT_TYPES } from "@/lib/arrangement-types";
import { Button, Field, TextInput, Textarea, inputClass } from "@/components/ui";

const EMPTY = { fullName: "", mobile: "", email: "", company: "", jobTitle: "", nationality: "" };

export function StaffRequestForm({
  departments,
  departmentId,
  today,
  managerName,
}: {
  departments: SearchOption[];
  departmentId: string;
  today: string;
  managerName: string | null;
}) {
  const [rows, setRows] = useState([{ ...EMPTY }]);
  const [guestCount, setGuestCount] = useState(1);
  const [giftRequired, setGiftRequired] = useState("no");
  const [giftType, setGiftType] = useState<(typeof GIFT_TYPES)[number]>("Welcome gift");

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
    <form action={submitStaffRequestAction} className="space-y-5">
      <FormBusy label="Sending request…" />
      <input type="hidden" name="visitorRows" value={rows.length} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Visit date" required>
          <TextInput name="visitDate" type="date" min={today} required defaultValue={today} />
        </Field>
        <Field label="Arrival time" required>
          <TextInput name="arrivalTime" type="time" required defaultValue="10:00" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Department" required>
          <SearchSelect name="departmentId" options={departments} defaultValue={departmentId} placeholder="Department" required />
        </Field>
        <Field label="Guest type" required>
          <select name="guestKind" className={inputClass} defaultValue="GUEST" required>
            <option value="GUEST">Guest</option>
            <option value="CUSTOMER">Customer</option>
            <option value="SUPPLIER">Supplier</option>
            <option value="VIP">VIP</option>
          </select>
        </Field>
      </div>
      <Field label="Purpose" required>
        <Textarea name="purpose" required placeholder="Why they are coming" className="min-h-20" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Driver and car">
          <select name="driverRequired" className={inputClass} defaultValue="no">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <Field label="Required gate pass">
          <select name="gatePassRequired" className={inputClass} defaultValue="no">
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
              <TextInput name="giftTypeOther" required placeholder="What should we prepare?" />
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
              <Field label="Mobile" required>
                <TextInput name={`mobile_${index}`} placeholder="Mobile" required defaultValue={row.mobile} />
              </Field>
              <Field label="Email" required>
                <TextInput name={`email_${index}`} type="email" placeholder="Email" required defaultValue={row.email} />
              </Field>
              <TextInput name={`company_${index}`} placeholder="Company" defaultValue={row.company} />
              <TextInput name={`jobTitle_${index}`} placeholder="Job title" defaultValue={row.jobTitle} />
              <TextInput name={`nationality_${index}`} placeholder="Nationality" defaultValue={row.nationality} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-[var(--muted)]">
        {managerName
          ? `This goes to ${managerName} for approval, then Administration handles it like an email visit request.`
          : "No line manager is on file, so this goes straight to Administration."}
      </p>
      <Button type="submit">Submit request</Button>
    </form>
  );
}
