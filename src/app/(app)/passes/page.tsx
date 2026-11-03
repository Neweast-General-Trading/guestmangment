import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { approveGatePassAction, completeGatePassAction } from "@/app/actions";
import { ArrangementPill } from "@/components/arrangement-status";
import { FileField } from "@/components/file-field";
import { GatePassButton } from "@/components/gate-pass-button";
import { FormBusy } from "@/components/form-busy";
import { filesForGuests, type GuestFileLink } from "@/components/guest-attachments";
import { VisitStatus, TypeTag } from "@/components/status";
import { Button, Card, PageHeader, Textarea } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { GUEST_KIND_LABEL, type GuestKind } from "@/lib/constants";
import { listGatePassQueue } from "@/lib/arrangements";
import { preparationNote } from "@/lib/preparation";
import { fmtDateTime } from "@/lib/format";
import { pageNumbers, paginate } from "@/lib/paging";
import { canApproveGatePass, canManageIntake, canSeePasses } from "@/lib/permissions";

const PAGE_SIZE = 12;

function passHref(tab: "pending" | "ready", page: number) {
  const params = new URLSearchParams();
  if (tab === "ready") params.set("tab", "ready");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/passes?${query}` : "/passes";
}

export default async function GatePassRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; approved?: string; received?: string; page?: string; tab?: string }>;
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
    const sharedFile = marked.length ? null : visit.gatePassFile;
    const people = (marked.length ? marked : visit.visitors).map((link) => {
      const inherited = !marked.length && !link.gatePassStatus && (visit.gatePassStatus === "PREPARING" || visit.gatePassStatus === "DONE");
      const ownFile = Boolean(link.gatePassFile);
      return {
        id: link.id,
        name: link.visitor.fullName,
        status: link.gatePassStatus || (inherited ? visit.gatePassStatus : "PENDING"),
        note: link.gatePassNote || (inherited ? visit.gatePassNote : ""),
        file: link.gatePassFile || sharedFile,
        fileHref: ownFile
          ? `/api/gate-passes/${visit.id}/${link.id}`
          : sharedFile
            ? `/api/gate-passes/${visit.id}`
            : "",
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
          fileHref: "",
          attachmentsJson: null,
        },
        files: files.loose,
      });
    }
    return rows;
  });
  const tab = query.tab === "ready" ? "ready" : "pending";
  const pendingCards = cards.filter((row) => row.person.status !== "DONE" && !row.person.file);
  const readyCards = cards.filter((row) => row.person.status === "DONE" || Boolean(row.person.file));
  const shown = tab === "ready" ? readyCards : pendingCards;
  const requested = Number(query.page);
  const view = paginate(shown, Number.isFinite(requested) ? requested : 1, PAGE_SIZE);
  const from = view.total ? (view.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(view.page * PAGE_SIZE, view.total);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Gate passes"
        description="Pending still needs approval or a file. Ready means the gate pass is uploaded. Cancelled and past visits stay off this list."
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
          <PassTabs tab={tab} pending={pendingCards.length} ready={readyCards.length} />
          <p className="mt-4 text-sm font-medium">{tab === "ready" ? "No ready gate passes." : "No gate passes waiting."}</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {tab === "ready" ? "Uploaded gate passes for upcoming visits show here." : "New gate passes appear here until the file is uploaded."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <PassTabs tab={tab} pending={pendingCards.length} ready={readyCards.length} />
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
                      <div className="mt-1 text-[13px] text-[var(--muted)]">
                        {[visit.meetingRoom || "Room not set", preparationNote(visit)].filter(Boolean).join(" · ")}
                      </div>
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
                    {row.person.fileHref ? <GatePassButton href={row.person.fileHref} /> : null}
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
                        <FileField name="file" accept="application/pdf,image/png,image/jpeg,image/webp" required />
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
                <PageLink href={passHref(tab, view.page - 1)} disabled={view.page <= 1} label="Previous page">
                  <ChevronLeft size={14} />
                </PageLink>
                {pageNumbers(view.page, view.pages).map((item, index) =>
                  item === "…" ? (
                    <span key={`gap-${index}`} className="px-1 text-[12px] text-[var(--faint)]">
                      …
                    </span>
                  ) : (
                    <PageLink key={item} href={passHref(tab, item)} current={item === view.page}>
                      {item}
                    </PageLink>
                  ),
                )}
                <PageLink href={passHref(tab, view.page + 1)} disabled={view.page >= view.pages} label="Next page">
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

function PassTabs({ tab, pending, ready }: { tab: "pending" | "ready"; pending: number; ready: number }) {
  const items = [
    { id: "pending" as const, label: "Pending", count: pending },
    { id: "ready" as const, label: "Ready", count: ready },
  ];
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[#faf7f7] p-1">
      {items.map((item) => {
        const active = tab === item.id;
        return (
          <Link
            key={item.id}
            href={passHref(item.id, 1)}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] whitespace-nowrap ${
              active ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "text-[var(--muted)] hover:bg-[#faf4f4]"
            }`}
          >
            {item.label}
            <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] ${active ? "bg-white" : "bg-[#f4eeee]"}`}>
              {item.count}
            </span>
          </Link>
        );
      })}
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
