"use client";

import Link from "next/link";
import { ApprovalSummary } from "@/components/approval-track";
import { PagedList } from "@/components/paged-list";
import { StatusPill, TypeTag } from "@/components/status";
import { fmtDate, fmtTime, typeLabel } from "@/lib/format";

type VisitRow = {
  id: string;
  visitCode: string;
  purpose: string;
  status: string;
  type: string;
  location: string | null;
  visitDate: Date | string;
  expectedArrival: Date | string;
  host: { name: string };
  department: { name: string };
  visitors: { visitor: { fullName: string; company: string | null; mobile: string } }[];
  approvals: { requiredRole: string; status: string; stepName: string; assignee?: { name: string; department?: { name: string } | null } | null }[];
};

function visitSearch(visit: VisitRow) {
  const names = visit.visitors.map((link) => `${link.visitor.fullName} ${link.visitor.company} ${link.visitor.mobile}`).join(" ");
  return `${visit.visitCode} ${visit.purpose} ${visit.host.name} ${visit.department.name} ${visit.status} ${visit.type} ${names}`;
}

export function VisitTable({
  visits,
  empty = "No visits match this view.",
}: {
  visits: VisitRow[];
  empty?: string;
}) {
  return (
    <PagedList items={visits} searchText={visitSearch} placeholder="Search visit, visitor, host…" empty={empty}>
      {(rows) => (
        <div className="table-wrap rounded-[10px] border border-[var(--line)] bg-white">
          <table className="data">
            <thead>
              <tr>
                <th>Visit</th>
                <th>Visitor</th>
                <th>Host</th>
                <th>When</th>
                <th>Type</th>
                <th>Approval</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((visit) => {
                const visitor = visit.visitors[0]?.visitor;
                return (
                  <tr key={visit.id}>
                    <td>
                      <Link href={`/visits/${visit.id}`} className="font-medium hover:underline">
                        {visit.visitCode}
                      </Link>
                      <div className="text-[12px] text-[var(--muted)]">{visit.department.name}</div>
                    </td>
                    <td>
                      <div className="font-medium">{visitor?.fullName ?? "—"}</div>
                      <div className="text-[12px] text-[var(--muted)]">{visitor?.company || visitor?.mobile}</div>
                    </td>
                    <td>
                      <div>{visit.host.name}</div>
                      <div className="text-[12px] text-[var(--muted)]">{visit.location || "—"}</div>
                    </td>
                    <td>
                      <div>{fmtDate(visit.visitDate)}</div>
                      <div className="text-[12px] text-[var(--muted)]">{fmtTime(visit.expectedArrival)}</div>
                    </td>
                    <td>
                      <TypeTag type={visit.type}>{typeLabel(visit.type)}</TypeTag>
                    </td>
                    <td>
                      <ApprovalSummary visit={visit} />
                    </td>
                    <td>
                      <StatusPill status={visit.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PagedList>
  );
}
