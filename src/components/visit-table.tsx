"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ApprovalSummary } from "@/components/approval-track";
import { CancelVisit } from "@/components/cancel-visit";
import { DayHeader, WhenChip } from "@/components/day-header";
import { PagedList } from "@/components/paged-list";
import { VisitStatus, TypeTag } from "@/components/status";
import { fmtTime, typeLabel } from "@/lib/format";
import { groupByDay, relativeWhen, visitEnd } from "@/lib/visit-order";

type VisitRow = {
  id: string;
  visitCode: string;
  visitTitle?: string;
  purpose: string;
  status: string;
  type: string;
  location: string | null;
  visitDate: Date | string;
  expectedArrival: Date | string;
  expectedDeparture?: Date | string | null;
  meetingRoom?: string | null;
  host: { name: string };
  createdBy?: { name: string };
  department: { name: string };
  visitors: { visitor: { fullName: string; company: string | null; mobile: string } }[];
  approvals: { requiredRole: string; status: string; stepName: string; assignee?: { name: string; department?: { name: string } | null } | null }[];
  canCancel?: boolean;
};

function visitSearch(visit: VisitRow) {
  const names = visit.visitors.map((link) => `${link.visitor.fullName} ${link.visitor.company} ${link.visitor.mobile}`).join(" ");
  return `${visit.visitCode} ${visit.visitTitle} ${visit.purpose} ${visit.host.name} ${visit.department.name} ${visit.status} ${visit.type} ${names}`;
}

export function VisitTable({
  visits,
  now,
  empty = "No visits match this view.",
}: {
  visits: VisitRow[];
  /** Server time in ms, so day groups and "in 2 h" labels match between server and browser. */
  now: number;
  empty?: string;
}) {
  return (
    <PagedList items={visits} searchText={visitSearch} placeholder="Search visit, visitor, host…" empty={empty}>
      {(rows) => (
        <div className="table-wrap rounded-[10px] border border-[var(--line)] bg-white">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Visit</th>
                <th>Visitor</th>
                <th>Host</th>
                <th>Type</th>
                <th>Approval</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {groupByDay(rows, now).map((group) => (
                <Fragment key={group.key}>
                  <tr>
                    <td colSpan={7} className="!border-b-0 !px-2 !pb-1 !pt-3">
                      <DayHeader group={{ ...group, count: group.items.length }} />
                    </td>
                  </tr>
                  {group.items.map((visit) => {
                    const visitor = visit.visitors[0]?.visitor;
                    return (
                      <tr key={visit.id} className={group.tone === "past" ? "opacity-80" : ""}>
                        <td className="whitespace-nowrap">
                          <div className="text-[15px] font-semibold tabular-nums">{fmtTime(visit.expectedArrival)}</div>
                          <div className="text-[12px] text-[var(--muted)] tabular-nums">to {fmtTime(visitEnd(visit))}</div>
                          <div className="mt-1">
                            <WhenChip label={relativeWhen(visit, now)} tone={group.tone} />
                          </div>
                        </td>
                        <td>
                          <Link href={`/visits/${visit.id}`} className="font-medium hover:underline">
                            {(visit.visitTitle || visit.purpose || "Guest visit").trim()} - {visit.createdBy?.name || visit.host.name}
                          </Link>
                          <div className="text-[12px] text-[var(--muted)]">{visit.meetingRoom || "Room not set"}</div>
                          <div className="text-[11px] text-[var(--faint)]">{visit.visitCode}</div>
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
                          <TypeTag type={visit.type}>{typeLabel(visit.type)}</TypeTag>
                        </td>
                        <td>
                          <ApprovalSummary visit={visit} />
                        </td>
                        <td>
                          <VisitStatus visit={visit} />
                          {visit.canCancel ? (
                            <div className="mt-2">
                              <CancelVisit visitId={visit.id} returnTo="/visits" />
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PagedList>
  );
}
