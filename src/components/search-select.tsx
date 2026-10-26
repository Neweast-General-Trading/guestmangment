"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { matches } from "@/lib/paging";
import { inputClass } from "@/components/ui";

export type SearchOption = { value: string; label: string; hint?: string };

export function SearchSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Search…",
  required,
}: {
  name: string;
  options: SearchOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const selected = options.find((item) => item.value === defaultValue);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState(selected ? `${selected.label}${selected.hint ? ` · ${selected.hint}` : ""}` : "");
  const picked = options.find((item) => item.value === value);
  const filtered = useMemo(
    () => options.filter((item) => matches(`${item.label} ${item.hint ?? ""}`, open ? query : "")),
    [options, open, query],
  );

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(picked ? `${picked.label}${picked.hint ? ` · ${picked.hint}` : ""}` : "");
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [picked]);

  function choose(item: SearchOption) {
    setValue(item.value);
    setQuery(`${item.label}${item.hint ? ` · ${item.hint}` : ""}`);
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={value} />
      <Search size={14} strokeWidth={1.75} className="pointer-events-none absolute left-2.5 top-2.5 text-[var(--faint)]" />
      <input
        className={`${inputClass} pl-8`}
        value={query}
        required={required ? !value : false}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      {open ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-[0_12px_32px_rgba(26,21,21,0.12)]">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-[var(--muted)]">No match.</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.value || item.label}
                type="button"
                className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-[#faf4f4] ${item.value === value ? "bg-[var(--brand-soft)]" : ""}`}
                onClick={() => choose(item)}
              >
                <span className="block font-medium">{item.label}</span>
                {item.hint ? <span className="block text-[12px] text-[var(--muted)]">{item.hint}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SearchChecks({
  name,
  options,
  defaultSelected = [],
  placeholder = "Search people",
}: {
  name: string;
  options: SearchOption[];
  defaultSelected?: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Set(defaultSelected));
  const filtered = options.filter((item) => matches(`${item.label} ${item.hint ?? ""}`, query));

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {Array.from(picked).map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <label className="relative mb-2 block">
        <Search size={14} strokeWidth={1.75} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-[var(--line)] bg-white pl-8 pr-3 text-[13px] outline-none focus:border-[var(--brand)]"
        />
      </label>
      <div className="grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
        {filtered.map((item) => (
          <label key={item.value} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-[13px]">
            <input type="checkbox" checked={picked.has(item.value)} onChange={() => toggle(item.value)} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.label}</span>
              {item.hint ? <span className="block truncate text-[12px] text-[var(--muted)]">{item.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {filtered.length === 0 ? <p className="text-[12px] text-[var(--muted)]">No match.</p> : null}
    </div>
  );
}
