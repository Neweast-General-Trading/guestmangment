import { Field, inputClass } from "@/components/ui";
import { GUEST_DOC_SLOTS, type GuestDocType } from "@/lib/guest-doc-types";

export function GuestDocFields({
  docs = [],
  disabled = false,
}: {
  docs?: { type: GuestDocType; name: string; href: string }[];
  disabled?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Documents</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">
          Optional. Upload an ID, passport, or visa. You can submit the request without any of them.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {GUEST_DOC_SLOTS.map((slot) => {
          const current = docs.find((doc) => doc.type === slot.id);
          return (
            <div key={slot.id} className="rounded-2xl border border-[var(--line)] bg-[#fcfafa] p-3">
              <Field label={slot.label}>
                <input className={inputClass} type="file" name={`doc_${slot.id}`} accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={disabled} />
              </Field>
              {current ? (
                <a className="mt-2 inline-block text-[12px] font-medium text-[var(--brand-ink)]" href={current.href}>
                  {current.name}
                </a>
              ) : (
                <p className="mt-2 text-[12px] text-[var(--muted)]">No file</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
