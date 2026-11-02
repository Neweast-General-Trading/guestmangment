import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { approveGatePassAction, completeGatePassAction } from "@/app/actions";
import { ArrangementPill } from "@/components/arrangement-status";
import { FormBusy } from "@/components/form-busy";
import { filesForGuests, type GuestFileLink } from "@/components/guest-attachments";
import { VisitStatus, TypeTag } from "@/components/status";
import { Button, Card, PageHeader, Textarea } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { listGatePassQueue } from "@/lib/arrangements";
import { fmtDateTime } from "@/lib/format";
import { pageNumbers, paginate } from "@/lib/paging";
import { canApproveGatePass, canManageIntake, canSeePasses } from "@/lib/permissions";

const PAGE_SIZE = 4;

function passHref(page: number) {
  return page <= 1 ? "/passes" : `/passes?page=${page}`;
}

export default async function GatePassRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; approved?: string; received?: string; page?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canSeePasses(session)) redirect("/dashboard");
  const query = await searchParams;
  const visits = await listGatePassQueue(session);
  const canApprove = canApproveGatePass(session);
  const canComplete = canManageIntake(session.role);
  const cards = visits.flatMap((visit) => {
    const marked = visit.visitors.filter((link) => link.gatePassRequired);
    const people = (marked.length ? marked : visit.visitors).map((link) => {
      const inherited = !marked.length && !link.gatePassStatus && (visit.gatePassStatus === "PREPARING" || visit.gatePassStatus === "DONE");
      return {
        id: link.id,
        name: link.visitor.fullName,
        status: link.gatePassStatus || (inherited ? visit.gatePassStatus : "PENDING"),
        note: link.gatePassNote || (inherited ? visit.gatePassNote : ""),
        file: link.gatePassFile,
        attachmentsJson: link.attachmentsJson,
      };
    });
    const files = filesForGuests(
      visit.id,
      people.map((person) => ({ id: person.id, name: person.name, attachmentsJson: person.attachmentsJson })),
      visit.attachmentsJson,
    );
    const rows = people.map((person) => ({
      key: person.id,
      visit,
      person,
      files: files.own.get(person.id) || [],
    }));
    if (files.loose.length) {
      rows.push({
        key: `${visit.id}-loose`,
        visit,
        person: {
          id: "",
          name: "Attachments",
          status: visit.gatePassStatus || "PENDING",
          note: visit.gatePassNote,
          file: null,
          attachmentsJson: null,
        },
        files: files.loose,
      });
    }
    return rows;
  });
  const requested = Number(query.page);
  const view = paginate(cards, Number.isFinite(requested) ? requested : 1, PAGE_SIZE);
  const from = view.total ? (view.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(view.page * PAGE_SIZE, view.total);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Gate passes"
        description="Approve the gate pass first. The file upload appears after approval."
      />
      {query.error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.error}
        </p>
      ) : null}
      {query.approved || query.received ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          {query.approved ? "Gate pass approved. Upload the file when it is ready." : "Gate pass uploaded."}
        </p>
      ) : null}

      {view.total === 0 ? (
        <Card>
          <p className="text-sm font-medium">No open gate pass requests.</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">New gate passes appear here as soon as a visit request reaches Administration.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {view.rows.map((row) => {
            const visit = row.visit;
            const kind = (visit.guestKind || "GUEST") as GuestKind;
            const waiting = row.person.status !== "PREPARING" && row.person.status !== "DONE";
            return (
              <Card key={row.key} padded={false}>
                <div className="border-b border-[var(--line)] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium">{(visit.visitTitle || visit.purpose || "Guest visit").trim()} - {visit.createdBy.name}</div>
                      <div className="mt-1 text-[13px] text-[var(--muted)]">{visit.meetingRoom || "Room not set"}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <TypeTag>{GUEST_KIND_LABEL[kind]}</TypeTag>
                      <VisitStatus visit={visit} />
                      <ArrangementPill status={row.person.status} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-[13px] text-[var(--muted)]">
                      {row.person.name} · {visit.department.name}
                      {visit.host?.name ? ` · Host ${visit.host.name}` : ""} · {fmtDateTime(visit.expectedArrival)}
                    </p>
                    <div className="shrink-0 text-[11px] text-[var(--faint)]">{visit.visitCode}</div>
                  </div>
                </div>
                <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(240px,0.95fr)]">
                  <div className="rounded-2xl border border-[#e2dcec] bg-[var(--tint-lilac)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Gate pass</div>
                      <ArrangementPill status={row.person.status} />
                    </div>
                    <p className="mt-2 text-[14px] font-medium">{row.person.name}</p>
                    <p className="mt-1 text-[13px] text-[var(--muted)]">
                      {waiting
                        ? "Approve this gate pass. The file upload appears after you approve."
                        : row.person.status === "PREPARING"
                          ? "Approved. Upload the gate pass."
                          : "Gate pass file is ready."}
                    </p>
                    {row.person.note ? <p className="mt-2 whitespace-pre-wrap text-[13px]">{row.person.note}</p> : null}
                    {row.person.file ? (
                      <a className="mt-2 inline-block text-[13px] font-medium text-[var(--brand-ink)]" href={row.person.id ? `/api/gate-passes/${visit.id}/${row.person.id}` : `/api/gate-passes/${visit.id}`}>
                        Open gate pass
                      </a>
                    ) : null}
                    {canApprove && waiting && row.person.id ? (
                      <form action={approveGatePassAction} className="mt-3 space-y-2">
                        <FormBusy label="Approving gate pass…" />
                        <input type="hidden" name="visitId" value={visit.id} />
                        <input type="hidden" name="linkId" value={row.person.id} />
                        <input type="hidden" name="from" value="passes" />
                        <Button type="submit">Approve</Button>
                      </form>
                    ) : null}
                    {(canApprove || canComplete) && row.person.status === "PREPARING" && row.person.id ? (
                      <form action={completeGatePassAction} className="mt-3 space-y-2">
                        <FormBusy label="Saving gate pass…" />
                        <p className="text-[13px] font-medium">Upload gate pass</p>
                        <input type="hidden" name="visitId" value={visit.id} />
                        <input type="hidden" name="linkId" value={row.person.id} />
                        <input type="hidden" name="from" value="passes" />
                        <input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required className="block w-full text-[13px]" />
                        <Textarea name="note" placeholder="Note (optional)" className="min-h-16" />
                        <Button type="submit">Upload gate pass</Button>
                      </form>
                    ) : null}
                  </div>
                  <GuestFiles files={row.files} />
                </div>
              </Card>
            );
          })}
          {view.pages > 1 ? (
            <nav aria-label="Gate pass pages" className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between">
              <p className="text-[12px] text-[var(--muted)]">
                {from}–{to} of {view.total}
              </p>
              <div className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white p-1">
                <PageLink href={passHref(view.page - 1)} disabled={view.page <= 1} label="Previous page">
                  <ChevronLeft size={14} />
                </PageLink>
                {pageNumbers(view.page, view.pages).map((item, index) =>
                  item === "…" ? (
                    <span key={`gap-${index}`} className="px-1 text-[12px] text-[var(--faint)]">
                      …
                    </span>
                  ) : (
                    <PageLink key={item} href={passHref(item)} current={item === view.page}>
                      {item}
                    </PageLink>
                  ),
                )}
                <PageLink href={passHref(view.page + 1)} disabled={view.page >= view.pages} label="Next page">
                  <ChevronRight size={14} />
                </PageLink>
              </div>
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}

function GuestFiles({ files }: { files: GuestFileLink[] }) {
  return (
    <aside className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Attachments</div>
      {files.length ? (
        <ul className="mt-3 space-y-3">
          {files.map((file) => (
            <li key={file.key}>
              <a className="text-[13px] font-medium text-[var(--brand-ink)]" href={file.href} target="_blank" rel="noopener noreferrer">
                {file.name}
              </a>
              <div className="text-[12px] text-[var(--muted)]">{file.label}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--muted)]">No attachment uploaded.</p>
      )}
    </aside>
  );
}

function PageLink({
  href,
  children,
  current,
  disabled,
  label,
}: {
  href: string;
  children: ReactNode;
  current?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const cls = `inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[12px] ${
    current ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "text-[var(--muted)] hover:bg-[#faf4f4]"
  } ${disabled ? "pointer-events-none opacity-40" : ""}`;
  if (disabled) return <span className={cls}>{children}</span>;
  return (
    <Link href={href} className={cls} aria-label={label} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
