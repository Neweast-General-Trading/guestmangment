"use client";

import { useState } from "react";
import { cancelVisitAction } from "@/app/actions";
import { Textarea } from "@/components/ui";

export function CancelReasonPopup({
  action,
  fields,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: { name: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  function close() {
    setReason("");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex h-8 items-center justify-center rounded-md border border-[#e4c4c2] bg-[#faf1f0] px-3 text-[12px] font-medium text-[#b14a42] hover:bg-[#f6e4e2]"
      >
        Cancel
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(26,21,21,0.45)] p-4"
          role="presentation"
          onClick={close}
        >
          <form
            action={action}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-reason-title"
            className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            {fields.map((field) => (
              <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ))}
            <h2 id="cancel-reason-title" className="text-base font-semibold">
              Cancellation reason
            </h2>
            <p className="mt-1 text-[13px] text-[var(--muted)]">Write the reason, then submit. Nothing is cancelled before that.</p>
            <Textarea
              name="reason"
              required
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Cancellation reason"
              aria-label="Cancellation reason"
              className="mt-3 min-h-24"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="inline-flex h-9 items-center justify-center rounded-md px-3 text-[13px] text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Keep
              </button>
              <button
                type="submit"
                disabled={!reason.trim()}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#b14a42] px-3 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function CancelVisit({ visitId, returnTo }: { visitId: string; returnTo: string }) {
  return (
    <CancelReasonPopup
      action={cancelVisitAction}
      fields={[
        { name: "visitId", value: visitId },
        { name: "returnTo", value: returnTo },
      ]}
    />
  );
}
