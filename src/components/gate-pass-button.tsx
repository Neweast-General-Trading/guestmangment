"use client";

import { useEffect, useState } from "react";

export function GatePassButton({ href, label = "Open gate pass" }: { href: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const downloadHref = `${href}${href.includes("?") ? "&" : "?"}download=1`;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex h-9 items-center justify-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[13px] font-medium text-[var(--brand-ink)] hover:bg-[#f3dede]"
      >
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="flex h-[min(820px,90vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
              <h2 className="text-[15px] font-medium">{label}</h2>
              <div className="flex items-center gap-2">
                <a
                  href={downloadHref}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)] hover:bg-[#f3dede]"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium text-[var(--ink)] hover:bg-[#faf7f7]"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe title={label} src={href} className="min-h-0 w-full flex-1 bg-[#f7f4f4]" />
          </div>
        </div>
      ) : null}
    </>
  );
}
