"use client";

import { useFormStatus } from "react-dom";

export function FormBusy({ label = "Working…" }: { label?: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14120f]/35">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-5 py-4 shadow-lg">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#ead8d8] border-t-[var(--brand)]" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

export function BusySubmit({
  children,
  working = "Working…",
  className,
  formAction,
}: {
  children: string;
  working?: string;
  className?: string;
  formAction?: React.ComponentProps<"button">["formAction"];
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" formAction={formAction} disabled={pending} className={className} aria-busy={pending}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {working}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
