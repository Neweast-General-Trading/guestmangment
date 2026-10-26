"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Empty } from "@/components/ui";
import { matches, paginate, PAGE_SIZE } from "@/lib/paging";

export function PagedList<T>({
  items,
  searchText,
  pageSize = PAGE_SIZE,
  placeholder = "Search",
  empty = "No results.",
  children,
}: {
  items: T[];
  searchText: (item: T) => string;
  pageSize?: number;
  placeholder?: string;
  empty?: string;
  children: (rows: T[]) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(
    () => items.filter((item) => matches(searchText(item), query)),
    [items, query, searchText],
  );
  const view = paginate(filtered, page, pageSize);
  const from = view.total ? (view.page - 1) * pageSize + 1 : 0;
  const to = Math.min(view.page * pageSize, view.total);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search size={14} strokeWidth={1.75} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={placeholder}
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-white pl-8 pr-3 text-[13px] outline-none focus:border-[var(--brand)]"
          />
        </label>
        <div className="text-[12px] text-[var(--muted)]">
          {from}–{to} of {view.total}
        </div>
      </div>
      {view.total === 0 ? (
        <div className="rounded-[10px] border border-[var(--line)] bg-white">
          <Empty title={empty} />
        </div>
      ) : (
        children(view.rows)
      )}
      {view.pages > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] disabled:opacity-40"
            disabled={view.page <= 1}
            onClick={() => setPage(view.page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[12px] text-[var(--muted)]">
            Page {view.page} of {view.pages}
          </span>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] disabled:opacity-40"
            disabled={view.page >= view.pages}
            onClick={() => setPage(view.page + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
