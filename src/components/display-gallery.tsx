"use client";

import { useEffect, useRef, useState } from "react";
import { addDisplayMediaAction, pickDisplayMediaAction } from "@/app/display-actions";
import { FormBusy } from "@/components/form-busy";
import { displayImageSrc } from "@/lib/display-label";
import type { DisplayMediaRow } from "@/lib/display";

export function DisplayGallery({
  items,
  screenId,
  label = "Gallery",
  className = "",
}: {
  items: DisplayMediaRow[];
  screenId?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg border border-[var(--line)] bg-white px-4 text-[14px] font-medium touch-manipulation hover:bg-[#faf7f7] md:h-8 md:min-h-8 md:w-auto md:text-[12px] ${className}`}
      >
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(26,21,21,0.48)] p-4 pt-16 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[min(88vh,720px)] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_28px_80px_rgba(26,21,21,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Saved photos</div>
                <h2 className="text-[15px] font-semibold">{screenId ? "Photo for this screen" : "Choose a photo"}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center rounded-lg border border-[var(--line)] bg-white px-4 text-[13px] font-medium"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              <form action={addDisplayMediaAction}>
                <FormBusy label="Saving photo…" />
                {screenId ? <input type="hidden" name="screenId" value={screenId} /> : null}
                <input
                  ref={fileRef}
                  type="file"
                  name="image"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    if (event.currentTarget.files?.[0]) event.currentTarget.form?.requestSubmit();
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-4 text-[14px] font-medium text-[var(--brand-ink)] sm:w-auto"
                >
                  Upload and save
                </button>
              </form>
              {items.length === 0 ? (
                <p className="mt-5 text-[14px] text-[var(--muted)]">No saved photos yet.</p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <form key={item.id} action={pickDisplayMediaAction}>
                      {screenId ? <input type="hidden" name="screenId" value={screenId} /> : null}
                      <input type="hidden" name="path" value={item.path} />
                      <button type="submit" className="block w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[#f7f4f4] text-left">
                        <span className="relative block aspect-video">
                          <img src={displayImageSrc(item.path)} alt="" className="absolute inset-0 h-full w-full object-contain" />
                        </span>
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
