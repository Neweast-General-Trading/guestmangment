"use client";

import { useState } from "react";

export function FileField({
  name = "file",
  accept,
  required,
}: {
  name?: string;
  accept?: string;
  required?: boolean;
}) {
  const [fileName, setFileName] = useState("");
  return (
    <label className="relative flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2 hover:border-[var(--brand)]">
      <span className="inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)]">
        Choose file
      </span>
      <span className={`min-w-0 truncate text-[13px] ${fileName ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
        {fileName || "No file selected"}
      </span>
      <input
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
      />
    </label>
  );
}
