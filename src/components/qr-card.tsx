"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCard({
  value,
  label,
  compact = false,
  framed = true,
}: {
  value: string;
  label?: string;
  compact?: boolean;
  framed?: boolean;
}) {
  const [src, setSrc] = useState<string>("");
  const px = compact ? 120 : 220;

  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: px, color: { dark: "#16181d", light: "#ffffff" } }).then(setSrc);
  }, [value, px]);

  return (
    <div className={framed ? "rounded-[10px] border border-[var(--line)] bg-white p-3 text-center" : "text-center"}>
      {src ? (
        <img src={src} alt="Visit QR" className={compact ? "mx-auto h-24 w-24" : "mx-auto h-40 w-40"} />
      ) : (
        <div className={compact ? "mx-auto h-24 w-24 bg-[#f4f5f7]" : "mx-auto h-40 w-40 bg-[#f4f5f7]"} />
      )}
      {label ? <div className="mt-1.5 text-[11px] leading-4 text-[var(--muted)]">{label}</div> : null}
    </div>
  );
}
