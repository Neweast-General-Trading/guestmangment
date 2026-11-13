"use client";

import { useState } from "react";
import { Field, TextInput, inputClass } from "@/components/ui";
import { GIFT_TYPES } from "@/lib/arrangement-types";

function Choice({
  name,
  title,
  hint,
  checked,
  onChange,
}: {
  name: string;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
        checked ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[#fcfafa] hover:border-[var(--line-strong)]"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        value="yes"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--brand)]"
      />
      <span>
        <span className="block text-[14px] font-semibold text-[var(--ink)]">{title}</span>
        <span className="mt-0.5 block text-[12px] text-[var(--muted)]">{hint}</span>
      </span>
    </label>
  );
}

export function VisitEssentials({
  gatePass = false,
  gift = false,
  giftType = "Welcome gift",
}: {
  gatePass?: boolean;
  gift?: boolean;
  giftType?: string;
}) {
  const known = GIFT_TYPES.includes(giftType as (typeof GIFT_TYPES)[number]);
  const [pass, setPass] = useState(gatePass);
  const [present, setPresent] = useState(gift);
  const [type, setType] = useState<(typeof GIFT_TYPES)[number]>(known ? (giftType as (typeof GIFT_TYPES)[number]) : "Other");

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <h2 className="text-sm font-semibold">For every guest</h2>
      <p className="mt-1 text-[12px] text-[var(--muted)]">One choice covers the whole visit, before the guest details.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Choice
          name="gatePassRequired"
          title="Gate pass"
          hint="Prepare a pass for every guest"
          checked={pass}
          onChange={setPass}
        />
        <Choice
          name="giftRequired"
          title="Protocol gift"
          hint="Prepare the same gift for every guest"
          checked={present}
          onChange={setPresent}
        />
      </div>
      {present ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Gift type" required>
            <select name="giftType" className={inputClass} value={type} onChange={(event) => setType(event.target.value as (typeof GIFT_TYPES)[number])} required>
              {GIFT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          {type === "Other" ? (
            <Field label="Describe the gift" required>
              <TextInput name="giftTypeOther" required defaultValue={known ? "" : giftType} placeholder="What should we prepare?" />
            </Field>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
