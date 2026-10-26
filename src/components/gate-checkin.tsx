"use client";

import { useEffect, useRef } from "react";
import { scanCheckInAction } from "@/app/actions";

export function GateCheckIn({
  token,
  visitCode,
  visitorName,
  gate = "in",
}: {
  token: string;
  visitCode: string;
  visitorName: string;
  gate?: "in" | "out";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const sent = useRef(false);
  const leaving = gate === "out";

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={scanCheckInAction} className="mt-6 rounded-[12px] border border-[var(--line)] bg-white p-5">
      <input type="hidden" name="qr" value={token} />
      <input type="hidden" name="from" value="invite" />
      <input type="hidden" name="gate" value={gate} />
      <div className="text-[11px] font-medium tracking-[0.16em] text-[var(--brand)]">SECURITY DESK</div>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">{leaving ? "Check out visitor" : "Check in visitor"}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {visitorName} · {visitCode}
      </p>
      <p className="mt-4 text-sm text-[var(--ink)]">
        {leaving ? "Reading QR code… completing check-out. Duration is calculated automatically." : "Reading QR code… completing check-in."}
      </p>
      <button type="submit" className="mt-4 h-10 w-full rounded-lg bg-[var(--brand)] text-[13px] font-medium text-white">
        {leaving ? "Check out now" : "Check in now"}
      </button>
    </form>
  );
}
