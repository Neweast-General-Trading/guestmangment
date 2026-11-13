"use client";

import { useState } from "react";
import { Field } from "@/components/ui";
import { GUEST_DOC_SLOTS, type GuestDocType } from "@/lib/guest-doc-types";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

type SlotState = {
  phase: "empty" | "loading" | "ready" | "error";
  name: string;
  reason: string;
};

function extensionOf(name: string) {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || "";
}

function reasonFor(file: File) {
  if (file.size > MAX_BYTES) return `${file.name} was not uploaded. The file must be under 8 MB.`;
  if (!ALLOWED.has(extensionOf(file.name))) return `${file.name} was not uploaded. Use a PDF or an image (PNG, JPG, WEBP).`;
  if (!file.size) return `${file.name} was not uploaded. The file is empty.`;
  return "";
}

export function GuestDocFields({
  docs = [],
  disabled = false,
  index = 0,
  guestName,
}: {
  docs?: { type: GuestDocType; name: string; href: string }[];
  disabled?: boolean;
  index?: number;
  guestName?: string;
}) {
  const [slots, setSlots] = useState<Record<string, SlotState>>({});

  function setSlot(id: string, next: SlotState) {
    setSlots((current) => ({ ...current, [id]: next }));
  }

  function onPick(id: string, list: FileList | null, input: HTMLInputElement) {
    const file = list?.[0];
    if (!file) {
      setSlot(id, { phase: "empty", name: "", reason: "" });
      return;
    }
    setSlot(id, { phase: "loading", name: file.name, reason: "" });
    window.setTimeout(() => {
      const reason = reasonFor(file);
      if (reason) {
        input.value = "";
        setSlot(id, { phase: "error", name: file.name, reason });
        return;
      }
      setSlot(id, { phase: "ready", name: file.name, reason: "" });
    }, 450);
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{guestName ? `Documents · ${guestName}` : "Documents"}</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">
          Optional. Each guest keeps their own ID, passport, or visa. A file that cannot be taken stays off the request and explains why.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {GUEST_DOC_SLOTS.map((slot) => {
          const current = docs.find((doc) => doc.type === slot.id);
          const state = slots[slot.id] || { phase: "empty" as const, name: "", reason: "" };
          return (
            <div key={slot.id} className="rounded-2xl border border-[var(--line)] bg-white p-3">
              <Field label={slot.label}>
                <label className={`relative flex items-center gap-3 rounded-xl border border-[var(--line-strong)] bg-[#fcfafa] px-3 py-2 ${disabled ? "" : "cursor-pointer hover:border-[var(--brand)]"}`}>
                  <span className="inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)]">
                    Choose file
                  </span>
                  <span className={`min-w-0 truncate text-[13px] ${state.phase === "ready" || (state.phase === "empty" && current) ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                    {state.phase === "loading" ? "Reading the file…" : state.phase === "ready" ? state.name : current ? current.name : "No file selected"}
                  </span>
                  <input
                    className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    type="file"
                    name={`doc_${index}_${slot.id}`}
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    disabled={disabled || state.phase === "loading"}
                    onChange={(event) => onPick(slot.id, event.target.files, event.currentTarget)}
                  />
                </label>
              </Field>
              {state.phase === "loading" ? (
                <p className="mt-2 flex items-center gap-2 text-[12px] text-[var(--muted)]">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#ead8d8] border-t-[var(--brand)]" />
                  Loading {state.name}
                </p>
              ) : null}
              {state.phase === "ready" ? (
                <p className="mt-2 text-[12px] font-medium text-[#1f7a4d]">Ready to send · {state.name}</p>
              ) : null}
              {state.phase === "error" ? <p className="mt-2 text-[12px] font-medium text-[#b14a42]">{state.reason}</p> : null}
              {state.phase === "empty" && current ? (
                <p className="mt-2 text-[12px] font-medium text-[#1f7a4d]">
                  Kept ·{" "}
                  <a className="underline" href={current.href}>
                    {current.name}
                  </a>
                </p>
              ) : null}
              {state.phase === "empty" && !current ? <p className="mt-2 text-[12px] text-[var(--muted)]">No file</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
