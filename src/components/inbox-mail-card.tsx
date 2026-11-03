"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function mailLabel(subject: string, from: string) {
  if (/^undeliverable\b/i.test(subject) || /mailer-daemon|postmaster/i.test(from)) return "Delivery failed";
  if (/^(automatic reply|out of office)\b/i.test(subject)) return "Automatic reply";
  return "Visit request";
}

export function InboxMailCard({
  id,
  subject,
  from,
  fromName,
  receivedAt,
}: {
  id: string;
  subject: string;
  from: string;
  fromName: string;
  receivedAt: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mail, setMail] = useState<{ text?: string; error?: string; visitHref?: string; visitCode?: string } | null>(null);
  const label = mailLabel(subject, from);
  const who = fromName && from && fromName !== from ? `${fromName} · ${from}` : fromName || from;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setLoading(true);
    fetch(`/api/inbox/message?id=${encodeURIComponent(id)}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data: { text?: string; error?: string; visitHref?: string; visitCode?: string }) => {
        if (!cancel) setMail(data.error ? { error: data.error } : data);
      })
      .catch(() => {
        if (!cancel) setMail({ error: "Could not open this mail." });
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, id]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-pointer rounded-2xl border border-[var(--line)] bg-white p-4 text-left shadow-[0_1px_0_rgba(20,32,31,0.03)] hover:border-[var(--line-strong)] hover:bg-[#fcfafa]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex h-6 items-center rounded-full bg-[#e8f1f8] px-2 text-[11px] font-medium text-[#1d4f7a]">{label}</span>
          <span className="text-[12px] text-[var(--muted)]">{receivedAt}</span>
        </div>
        <div className="mt-2 text-[13px] font-medium">{subject || "No subject"}</div>
        <div className="mt-1 text-[12px] text-[var(--muted)]">{who}</div>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={subject || "Mail"}
            className="flex max-h-[min(720px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[var(--line)] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">{label}</div>
              <h2 className="mt-1 text-[15px] font-medium">{subject || "No subject"}</h2>
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                {who}
                {receivedAt ? ` · ${receivedAt}` : ""}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {loading ? <p className="text-[13px] text-[var(--muted)]">Opening…</p> : null}
              {mail?.error ? <p className="text-[13px] text-[var(--brand-ink)]">{mail.error}</p> : null}
              {mail?.text ? <pre className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--ink)]">{mail.text}</pre> : null}
              {!loading && mail && !mail.error && !mail.text ? <p className="text-[13px] text-[var(--muted)]">This message has no text.</p> : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
              {mail?.visitHref ? (
                <Link
                  href={mail.visitHref}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)] hover:bg-[#f3dede]"
                >
                  Open visit{mail.visitCode ? ` · ${mail.visitCode}` : ""}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium text-[var(--ink)] hover:bg-[#faf7f7]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
