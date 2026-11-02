import { redirect } from "next/navigation";
import { AccessPager } from "@/components/access-pager";
import { AccessRow } from "@/components/access-row";
import { Card, Empty, PageHeader, TextInput } from "@/components/ui";
import {
  ACCESS_GROUP_LABEL,
  ACCESS_GROUP_NATURE,
  ACCESS_GROUPS,
  ACCESS_PAGE_SIZE,
  accessDeskLabel,
  accessHref,
  accessListWhere,
  canManageAccess,
  isAccessGroup,
  parseAccessPage,
  parseAccessPageSize,
} from "@/lib/access";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; q?: string; page?: string; pageSize?: string; saved?: string; error?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageAccess(session.email)) redirect("/dashboard");

  const query = await searchParams;
  const group = isAccessGroup(query.group || "") ? query.group || "ADMINISTRATION" : "ADMINISTRATION";
  const q = query.q?.trim() || "";
  const pageSize = parseAccessPageSize(query.pageSize);
  const requestedPage = parseAccessPage(query.page);
  const where = accessListWhere({ group, q });

  const [total, counts] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ["accessGroup"],
      where: { isActive: true, accessGroup: { in: [...ACCESS_GROUPS] } },
      _count: true,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const page = Math.min(requestedPage, pages);
  if (requestedPage !== page) redirect(accessHref({ group, q, page, pageSize }));

  const people = await prisma.user.findMany({
    where,
    include: { department: true },
    orderBy: [{ name: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const countByGroup = Object.fromEntries(counts.map((row) => [row.accessGroup || "", row._count]));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Access"
        description="Four desks. Everyone else stays an employee and can submit a visit request."
      />
      {query.error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.error}
        </p>
      ) : null}
      {query.saved ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">Access saved.</p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACCESS_GROUPS.map((item) => (
          <a key={item} href={accessHref({ group: item, q, pageSize })}>
            <Card tone={group === item ? "sand" : "plain"}>
              <div className="text-[13px] font-semibold">{ACCESS_GROUP_LABEL[item]}</div>
              <p className="mt-1 text-[12px] text-[var(--muted)]">{ACCESS_GROUP_NATURE[item]}</p>
              <p className="mt-2 text-[12px] text-[var(--faint)]">{countByGroup[item] || 0} people</p>
            </Card>
          </a>
        ))}
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-3 md:flex-row md:items-end md:justify-between">
          <form className="flex flex-1 flex-col gap-2 sm:flex-row">
            {group ? <input type="hidden" name="group" value={group} /> : null}
            {pageSize !== ACCESS_PAGE_SIZE ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
            <TextInput name="q" defaultValue={q} placeholder="Search name, email, or department" />
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium hover:bg-[#faf4f4]"
            >
              Search
            </button>
          </form>
        </div>
        <div className="hidden border-b border-[var(--line)] px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-[var(--faint)] md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div>Person / role nature</div>
          <div>Role</div>
          <div>Desk</div>
          <div />
        </div>
        {people.length ? (
          people.map((person) => (
            <AccessRow
              key={person.id}
              group={group}
              q={q}
              page={page}
              pageSize={pageSize}
              person={{
                id: person.id,
                name: person.name,
                email: person.email,
                role: person.role,
                jobTitle: person.jobTitle,
                accessGroup: person.accessGroup,
                departmentName: person.department?.name || null,
                nature: accessDeskLabel(person),
              }}
            />
          ))
        ) : (
          <Empty title="No people in this view" hint="Search a name or email to grant access." />
        )}
        <AccessPager page={page} pages={pages} total={total} pageSize={pageSize} group={group} q={q} />
      </Card>
    </div>
  );
}
