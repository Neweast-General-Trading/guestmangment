import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ACCESS_PAGE_SIZE, ACCESS_PAGE_SIZES, accessHref } from "@/lib/access";
import { pageNumbers } from "@/lib/paging";
import { inputClass } from "@/components/ui";

function PageLink({
  href,
  children,
  current,
  disabled,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const cls = `inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[12px] ${
    current
      ? "border-[var(--brand)] bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]"
      : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#faf4f4]"
  } ${disabled ? "pointer-events-none opacity-40" : ""}`;
  if (disabled) {
    return (
      <span className={cls} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cls} aria-label={ariaLabel} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

export function AccessPager({
  page,
  pages,
  total,
  pageSize,
  group,
  q,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  group: string;
  q: string;
}) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  const hrefFor = (nextPage: number) => accessHref({ group, q, page: nextPage, pageSize });

  return (
    <nav aria-label="Access pages" className="flex flex-col gap-3 border-t border-[var(--line)] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[12px] text-[var(--muted)]">
          {from}–{to} of {total}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <PageLink href={hrefFor(1)} disabled={page <= 1}>
            First
          </PageLink>
          <PageLink href={hrefFor(page - 1)} disabled={page <= 1} ariaLabel="Previous page">
            <ChevronLeft size={14} />
          </PageLink>
          {pageNumbers(page, pages).map((item, index) =>
            item === "…" ? (
              <span key={`gap-${index}`} className="px-1 text-[12px] text-[var(--faint)]">
                …
              </span>
            ) : (
              <PageLink key={item} href={hrefFor(item)} current={item === page}>
                {item}
              </PageLink>
            ),
          )}
          <PageLink href={hrefFor(page + 1)} disabled={page >= pages} ariaLabel="Next page">
            <ChevronRight size={14} />
          </PageLink>
          <PageLink href={hrefFor(pages)} disabled={page >= pages}>
            Last
          </PageLink>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 text-[12px] text-[var(--muted)]">
          <span className="mr-1">Per page</span>
          {ACCESS_PAGE_SIZES.map((size) => (
            <PageLink
              key={size}
              href={accessHref({ group, q, page: 1, pageSize: size })}
              current={size === pageSize}
            >
              {size}
            </PageLink>
          ))}
        </div>
        {pages > 1 ? (
          <form action="/access" className="flex items-center gap-2">
            {group ? <input type="hidden" name="group" value={group} /> : null}
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {pageSize !== ACCESS_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
            <label className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
              Go to
              <input
                name="page"
                type="number"
                min={1}
                max={pages}
                defaultValue={page}
                className={`${inputClass} h-8 w-16`}
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-md border border-[var(--line)] bg-white px-2.5 text-[12px] font-medium hover:bg-[#faf4f4]"
            >
              Go
            </button>
          </form>
        ) : null}
      </div>
    </nav>
  );
}
