"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";
import { matches } from "@/lib/paging";

export function InvitePeople({
  people,
  bookerEmail,
  initial = [],
  hint = "They receive the Outlook meeting when the room is booked, and a confirmation email when the room accepts.",
}: {
  people: { value: string; label: string; hint?: string }[];
  bookerEmail: string;
  initial?: { email: string; name: string }[];
  hint?: string;
}) {
  const booker = bookerEmail.trim().toLowerCase();
  const [picked, setPicked] = useState<{ email: string; name: string }[]>(
    initial.filter((item) => item.email.trim().toLowerCase() !== booker),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = new Set(picked.map((item) => item.email));
  const options = people.filter((item) => {
    const email = item.value.trim().toLowerCase();
    return email.includes("@") && email !== booker && !chosen.has(email);
  });
  const filtered = options.filter((item) => matches(`${item.label} ${item.hint ?? ""} ${item.value}`, query)).slice(0, 8);

  function add(email: string, name: string) {
    const value = email.trim().toLowerCase();
    if (!value.includes("@") || value === booker || chosen.has(value) || picked.length >= 20) return;
    setPicked((current) => [...current, { email: value, name: name.trim() || value.split("@")[0] || value }]);
    setQuery("");
    setOpen(false);
  }

  function addTyped() {
    for (const part of query.split(/[\s,;]+/)) add(part, "");
  }

  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">Invite people</div>
      <p className="mb-2 text-[11px] text-[var(--muted)]">{hint}</p>
      {picked.length ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {picked.map((item) => (
            <span key={item.email} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[#faf7f7] px-2 py-0.5 text-[11px]">
              {item.name}
              <button
                type="button"
                className="cursor-pointer text-[var(--muted)] hover:text-[#b14a42]"
                onClick={() => setPicked((current) => current.filter((row) => row.email !== item.email))}
                aria-label={`Remove ${item.name}`}
              >
                ×
              </button>
              <input type="hidden" name="inviteEmail" value={item.email} />
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <input
          className={inputClass}
          value={query}
          placeholder="Name or email"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (filtered[0] && !query.includes("@")) add(filtered[0].value, filtered[0].label);
            else addTyped();
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
        {open && (filtered.length || query.includes("@")) ? (
          <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-[0_12px_32px_rgba(26,21,21,0.12)]">
            {filtered.map((item) => (
              <button
                key={item.value}
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#faf4f4]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(item.value, item.label)}
              >
                <span className="block font-medium">{item.label}</span>
                {item.hint ? <span className="block text-[12px] text-[var(--muted)]">{item.hint}</span> : null}
              </button>
            ))}
            {query.includes("@") ? (
              <button type="button" className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#faf4f4]" onMouseDown={(event) => event.preventDefault()} onClick={addTyped}>
                Add {query.trim()}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
