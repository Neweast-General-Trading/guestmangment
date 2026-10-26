"use client";

import Link from "next/link";
import { ApprovalSummary } from "@/components/approval-track";
import { PagedList } from "@/components/paged-list";
import { StatusPill } from "@/components/status";
import { Button, TextInput } from "@/components/ui";
import { approvalDesk } from "@/lib/approval-state";

function authorizationBanner(status: string) {
  if (["APPROVED", "INVITATION_SENT", "EXPECTED", "ARRIVED", "SECURITY_VERIFICATION"].includes(status)) {
    return { tone: "ok" as const, label: "APPROVED – READY FOR CHECK-IN" };
  }
  if (["PENDING_APPROVAL", "WAITING_AT_GATE"].includes(status)) {
    return { tone: "warn" as const, label: "PENDING APPROVAL – DO NOT ALLOW ENTRY" };
  }
  if (status === "CANCELLED") return { tone: "muted" as const, label: "CANCELLED" };
  if (status === "EXPIRED") return { tone: "muted" as const, label: "EXPIRED" };
  if (status === "REJECTED" || status === "ACCESS_DENIED") {
    return { tone: "danger" as const, label: "REJECTED – ACCESS NOT AUTHORIZED" };
  }
  if (["CHECKED_IN", "CURRENTLY_INSIDE", "IN_MEETING", "OVERDUE"].includes(status)) {
    return { tone: "ok" as const, label: "CURRENTLY INSIDE" };
  }
  return { tone: "muted" as const, label: "CHECKED OUT / COMPLETED" };
}
import { NEED_CATEGORIES } from "@/lib/guest-needs";
import { VISIT_TYPE_LABEL } from "@/lib/constants";

const TASK_STATUSES = [
  { code: "REQUESTED", label: "Requested" },
  { code: "IN_PROGRESS", label: "In progress" },
  { code: "DONE", label: "Done" },
] as const;
import { fmtDate, fmtDateTime, fmtTime, liveDuration, typeLabel } from "@/lib/format";

export function InsideTable({
  visits,
}: {
  visits: {
    id: string;
    status: string;
    location: string | null;
    meetingRoom: string | null;
    checkInAt: Date | string | null;
    expectedDeparture: Date | string | null;
    host: { name: string };
    department: { name: string };
    badges: { number: string }[];
    visitors: { visitor: { fullName: string; company: string | null } }[];
  }[];
}) {
  return (
    <PagedList
      items={visits}
      searchText={(visit) => `${visit.visitors[0]?.visitor.fullName} ${visit.visitors[0]?.visitor.company} ${visit.host.name} ${visit.department.name} ${visit.badges[0]?.number ?? ""}`}
      placeholder="Search visitor, host, badge…"
      empty="No visitors are currently inside."
    >
      {(rows) => (
        <div className="table-wrap rounded-[10px] border border-[var(--line)] bg-white">
          <table className="data">
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Host</th>
                <th>Department</th>
                <th>Check-in</th>
                <th>Expected leave</th>
                <th>Duration</th>
                <th>Badge</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((visit) => (
                <tr key={visit.id}>
                  <td>
                    <Link href={`/visits/${visit.id}`} className="font-medium hover:underline">
                      {visit.visitors[0]?.visitor.fullName}
                    </Link>
                    <div className="text-[12px] text-[var(--muted)]">{visit.visitors[0]?.visitor.company}</div>
                  </td>
                  <td>{visit.host.name}</td>
                  <td>{visit.department.name}</td>
                  <td>{fmtTime(visit.checkInAt)}</td>
                  <td>{fmtTime(visit.expectedDeparture)}</td>
                  <td>{liveDuration(visit.checkInAt)}</td>
                  <td>{visit.badges[0]?.number ?? "—"}</td>
                  <td>{(visit.meetingRoom && visit.meetingRoom !== "Yes" ? visit.meetingRoom : null) || visit.location}</td>
                  <td>
                    <StatusPill status={visit.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PagedList>
  );
}

export function BadgeTable({
  badges,
}: {
  badges: {
    id: string;
    number: string;
    issuedAt: Date | string;
    returnedAt: Date | string | null;
    closed: boolean;
    visit: {
      id: string;
      visitCode: string;
      host: { name: string };
      department: { name: string };
      visitors: { visitor: { fullName: string } }[];
    };
  }[];
}) {
  return (
    <PagedList
      items={badges}
      searchText={(badge) => `${badge.number} ${badge.visit.visitors[0]?.visitor.fullName} ${badge.visit.host.name} ${badge.visit.visitCode}`}
      placeholder="Search badge, visitor, host…"
      empty="No badges."
    >
      {(rows) => (
        <div className="table-wrap rounded-[10px] border border-[var(--line)] bg-white">
          <table className="data">
            <thead>
              <tr>
                <th>Badge</th>
                <th>Visitor</th>
                <th>Host</th>
                <th>Visit</th>
                <th>Issued</th>
                <th>Returned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((badge) => (
                <tr key={badge.id}>
                  <td className="font-medium">{badge.number}</td>
                  <td>{badge.visit.visitors[0]?.visitor.fullName}</td>
                  <td>
                    {badge.visit.host.name}
                    <div className="text-[12px] text-[var(--muted)]">{badge.visit.department.name}</div>
                  </td>
                  <td>
                    <Link href={`/visits/${badge.visit.id}`} className="hover:underline">
                      {badge.visit.visitCode}
                    </Link>
                  </td>
                  <td>{fmtDateTime(badge.issuedAt)}</td>
                  <td>{badge.closed ? fmtDateTime(badge.returnedAt) : "Open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PagedList>
  );
}

export function ParkingTable({
  vehicles,
}: {
  vehicles: {
    id: string;
    plate: string;
    parkingSlot: string | null;
    visit: {
      id: string;
      visitCode: string;
      status: string;
      host: { name: string };
      visitors: { visitor: { fullName: string } }[];
    };
  }[];
}) {
  return (
    <PagedList
      items={vehicles}
      searchText={(vehicle) => `${vehicle.plate} ${vehicle.parkingSlot} ${vehicle.visit.visitors[0]?.visitor.fullName} ${vehicle.visit.host.name} ${vehicle.visit.visitCode}`}
      placeholder="Search plate, visitor, host…"
      empty="No vehicles."
    >
      {(rows) => (
        <div className="table-wrap rounded-[10px] border border-[var(--line)] bg-white">
          <table className="data">
            <thead>
              <tr>
                <th>Plate</th>
                <th>Visitor</th>
                <th>Host</th>
                <th>Slot</th>
                <th>Visit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td className="font-medium">{vehicle.plate}</td>
                  <td>{vehicle.visit.visitors[0]?.visitor.fullName}</td>
                  <td>{vehicle.visit.host.name}</td>
                  <td>{vehicle.parkingSlot || "Unassigned"}</td>
                  <td>
                    <Link href={`/visits/${vehicle.visit.id}`} className="hover:underline">
                      {vehicle.visit.visitCode}
                    </Link>
                  </td>
                  <td>{vehicle.visit.status.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PagedList>
  );
}

export function AuditTable({
  logs,
}: {
  logs: {
    id: string;
    createdAt: Date | string;
    action: string;
    module: string;
    previousValue: string | null;
    newValue: string | null;
    user: { name: string } | null;
    visit: { visitCode: string } | null;
  }[];
}) {
  return (
    <PagedList
      items={logs}
      searchText={(log) => `${log.action} ${log.module} ${log.user?.name ?? ""} ${log.visit?.visitCode ?? ""}`}
      placeholder="Search action, user, visit…"
      empty="No audit rows."
    >
      {(rows) => (
        <div className="table-wrap rounded-[10px] border border-[var(--line)] bg-white">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Visit</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => (
                <tr key={log.id}>
                  <td>{fmtDateTime(log.createdAt)}</td>
                  <td>{log.user?.name ?? "System"}</td>
                  <td>{log.action}</td>
                  <td>{log.module}</td>
                  <td>{log.visit?.visitCode ?? "—"}</td>
                  <td className="max-w-xs truncate text-[12px] text-[var(--muted)]">{log.previousValue || log.newValue || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PagedList>
  );
}

export function ServiceMasterTable({
  services,
}: {
  services: {
    id: string;
    label: string;
    hint: string;
    category: string;
    active: boolean;
    owners: { user: { name: string; jobTitle?: string | null } }[];
    _count: { tasks: number };
  }[];
}) {
  return (
    <PagedList
      items={services}
      searchText={(item) =>
        `${item.label} ${item.hint} ${item.category} ${NEED_CATEGORIES.find((row) => row.code === item.category)?.label || ""} ${item.owners.map((owner) => owner.user.name).join(" ")}`
      }
      pageSize={50}
      placeholder="Search service or owner…"
      empty="No services yet."
    >
      {(rows) => {
        const groups = NEED_CATEGORIES.filter((row) => row.code !== "all")
          .map((row) => ({ ...row, items: rows.filter((item) => item.category === row.code) }))
          .filter((row) => row.items.length);
        return (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.code} className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-white">
                <div className="border-b border-[var(--line)] bg-[#faf7f7] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--faint)]">
                  {group.label}
                  <span className="ml-2 font-normal normal-case tracking-normal">{group.items.length}</span>
                </div>
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-[var(--line)] text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Service</th>
                      <th className="px-3 py-2 font-medium">Responsible</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.id} className="border-b border-[var(--line)] last:border-0">
                        <td className="px-3 py-2">
                          <Link href={`/master/services/${item.id}`} className="font-medium hover:text-[var(--brand)]">
                            {item.label}
                          </Link>
                          <div className="text-[12px] text-[var(--muted)]">{item.hint}</div>
                        </td>
                        <td className="px-3 py-2 text-[var(--muted)]">
                          {item.owners.length
                            ? item.owners.map((owner) => owner.user.name).join(", ")
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`need-pill ${item.active ? "bg-[#e8f6ee] text-[#1f7a4d]" : "bg-[#f1f2f4] text-[var(--muted)]"}`}>
                            {item.active ? "Active" : "Off"}
                          </span>
                          {item._count.tasks ? <span className="ml-2 text-[12px] text-[var(--faint)]">{item._count.tasks} task(s)</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        );
      }}
    </PagedList>
  );
}

export function RuleList({
  rules,
  onToggle,
}: {
  rules: { id: string; visitType: string; departmentCode: string | null; visitorCategory: string | null; isActive: boolean; stepsJson: string }[];
  onToggle: (id: string, isActive: boolean) => void | Promise<void>;
}) {
  return (
    <PagedList
      items={rules}
      searchText={(rule) => `${rule.visitType} ${rule.departmentCode ?? ""} ${rule.visitorCategory ?? ""} ${rule.stepsJson}`}
      placeholder="Search rule…"
      empty="No approval rules."
      pageSize={6}
    >
      {(rows) => (
        <div className="space-y-2">
          {rows.map((rule) => {
            let steps = rule.stepsJson;
            try {
              steps = (JSON.parse(rule.stepsJson) as { name?: string }[]).map((step) => step.name).filter(Boolean).join(" → ");
            } catch {
              /* keep raw */
            }
            return (
              <div key={rule.id} className="flex items-start justify-between gap-3 rounded-lg bg-[#f7f8fa] px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">
                    {VISIT_TYPE_LABEL[rule.visitType as keyof typeof VISIT_TYPE_LABEL] ?? rule.visitType}
                    {rule.departmentCode ? ` · ${rule.departmentCode}` : ""}
                    {rule.visitorCategory ? ` · ${rule.visitorCategory}` : ""}
                  </div>
                  <div className="truncate text-[12px] text-[var(--muted)]">{steps}</div>
                </div>
                <form action={onToggle.bind(null, rule.id, !rule.isActive)}>
                  <button className="text-[12px] text-[var(--muted)]">{rule.isActive ? "Disable" : "Enable"}</button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </PagedList>
  );
}

export function DirectoryList({
  visitors,
  canRestrict,
  onRestrict,
}: {
  canRestrict: boolean;
  onRestrict: (formData: FormData) => void | Promise<void>;
  visitors: {
    id: string;
    fullName: string;
    company: string | null;
    mobile: string;
    email: string | null;
    restricted: boolean;
    visitLinks: { id: string; visit: { id: string; visitCode: string } }[];
  }[];
}) {
  return (
    <PagedList
      items={visitors}
      searchText={(visitor) => `${visitor.fullName} ${visitor.company ?? ""} ${visitor.mobile} ${visitor.email ?? ""}`}
      placeholder="Search visitor, mobile, company…"
      empty="No visitors."
    >
      {(rows) => (
        <div className="space-y-3">
          {rows.map((visitor) => (
            <div key={visitor.id} className="rounded-[10px] border border-[var(--line)] bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-medium">
                    {visitor.fullName}
                    {visitor.restricted ? <span className="ml-2 text-[11px] text-[#b42318]">Restricted</span> : null}
                  </div>
                  <div className="text-[13px] text-[var(--muted)]">
                    {visitor.company || "—"} · {visitor.mobile} · {visitor.visitLinks.length} visit(s)
                  </div>
                </div>
                {canRestrict ? (
                  <form action={onRestrict} className="flex items-center gap-2">
                    <input type="hidden" name="visitorId" value={visitor.id} />
                    <input type="hidden" name="restricted" value={visitor.restricted ? "off" : "on"} />
                    <TextInput name="note" placeholder="Restriction note" className="w-48" />
                    <button className="h-9 rounded-lg border border-[var(--line)] px-3 text-[12px]">
                      {visitor.restricted ? "Clear" : "Restrict"}
                    </button>
                  </form>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[var(--muted)]">
                {visitor.visitLinks.slice(0, 5).map((link) => (
                  <Link key={link.id} href={`/visits/${link.visit.id}`} className="rounded-md bg-[#f4f5f7] px-2 py-1">
                    {link.visit.visitCode}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PagedList>
  );
}

export function ApprovalsList({
  items,
  onDecide,
}: {
  onDecide: (formData: FormData) => void | Promise<void>;
  items: {
    id: string;
    requiredRole: string;
    assigneeId: string | null;
    stepName: string;
    status: string;
    visit: {
      id: string;
      visitCode: string;
      purpose: string;
      status: string;
      hostId: string;
      createdById: string;
      expectedArrival: Date | string;
      host: { name: string };
      department: { name: string };
      visitors: { visitor: { fullName: string } }[];
      approvals: { requiredRole: string; status: string; stepName: string; assignee?: { name: string; department?: { name: string } | null } | null }[];
    };
    assignee: { name: string; department?: { name: string } | null } | null;
  }[];
}) {
  return (
    <PagedList
      items={items}
      searchText={(item) => `${item.visit.visitCode} ${item.visit.visitors[0]?.visitor.fullName} ${item.visit.host.name} ${item.visit.department.name} ${item.stepName}`}
      placeholder="Search visit, visitor, host…"
      empty="No approvals waiting for you."
    >
      {(rows) => (
        <div className="space-y-3">
          {rows.map((item) => (
            <div key={item.id} className="rounded-[10px] border border-[var(--line)] bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <Link href={`/visits/${item.visit.id}`} className="font-medium hover:underline">
                    {item.visit.visitCode}
                  </Link>
                  <div className="mt-1 text-[13px] text-[var(--muted)]">
                    {item.visit.visitors[0]?.visitor.fullName} · {item.visit.host.name} · {item.visit.department.name}
                  </div>
                  <div className="mt-2 text-[13px]">{item.visit.purpose}</div>
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--muted)]">
                    <span>{approvalDesk(item, item.visit)}</span>
                    <span>·</span>
                    <span>{item.stepName}</span>
                    <span>·</span>
                    <span>{fmtDateTime(item.visit.expectedArrival)}</span>
                    <StatusPill status={item.visit.status} />
                  </div>
                </div>
                <form action={onDecide} className="flex min-w-64 flex-col gap-2">
                  <input type="hidden" name="visitId" value={item.visit.id} />
                  <TextInput name="comments" placeholder="Comment" />
                  <div className="grid grid-cols-2 gap-2">
                    <button name="decision" value="APPROVED" className="h-9 rounded-lg bg-[var(--accent)] text-[13px] text-white">
                      Approve
                    </button>
                    <button name="decision" value="REJECTED" className="h-9 rounded-lg border border-[var(--line-strong)] text-[13px]">
                      Reject
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </PagedList>
  );
}

export function ServiceTaskList({
  tasks,
  onUpdate,
}: {
  onUpdate: (formData: FormData) => void | Promise<void>;
  tasks: {
    id: string;
    status: string;
    requesterNotes: string | null;
    visitId: string;
    service: { label: string };
    visit: {
      visitCode: string;
      visitDate: Date | string;
      expectedArrival: Date | string;
      host: { name: string };
      visitors: { visitor: { fullName: string } }[];
    };
  }[];
}) {
  return (
    <PagedList
      items={tasks}
      searchText={(task) => `${task.service.label} ${task.visit.visitCode} ${task.visit.visitors[0]?.visitor.fullName} ${task.visit.host.name} ${task.status}`}
      placeholder="Search service, visit, guest…"
      empty="No service tasks yet."
    >
      {(rows) => (
        <div className="space-y-3">
          {rows.map((task) => {
            const visitor = task.visit.visitors[0]?.visitor;
            const status = TASK_STATUSES.find((item) => item.code === task.status)?.label || task.status;
            return (
              <div key={task.id} className="rounded-[10px] border border-[var(--line)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-medium">{task.service.label}</div>
                    <div className="text-[12px] text-[var(--muted)]">
                      {task.visit.visitCode} · {visitor?.fullName || "Guest"} · {task.visit.host.name} · {fmtDate(task.visit.visitDate)} {fmtTime(task.visit.expectedArrival)}
                    </div>
                    {task.requesterNotes ? <p className="mt-1 text-[13px]">{task.requesterNotes}</p> : null}
                  </div>
                  <span className="need-pill bg-[var(--brand-soft)] text-[var(--brand-ink)]">{status}</span>
                </div>
                <form action={onUpdate} className="mt-3 grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end">
                  <input type="hidden" name="taskId" value={task.id} />
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[var(--muted)]">Status</span>
                    <select name="status" defaultValue={task.status} className="h-9 w-full rounded-lg border border-[var(--line)] px-2 text-[13px]">
                      {TASK_STATUSES.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[var(--muted)]">Update</span>
                    <TextInput name="note" placeholder="Booked, waiting on confirmation…" />
                  </label>
                  <Button type="submit">Save update</Button>
                </form>
                <Link href={`/visits/${task.visitId}`} className="mt-2 inline-block text-[12px] text-[var(--muted)] hover:text-[var(--ink)]">
                  Open visit
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </PagedList>
  );
}

export function NoticeList({
  items,
  onRead,
}: {
  onRead: (id: string) => void | Promise<void>;
  items: {
    id: string;
    title: string;
    message: string;
    read: boolean;
    channel: string;
    createdAt: Date | string;
    visit: { id: string; visitCode: string } | null;
  }[];
}) {
  return (
    <PagedList
      items={items}
      searchText={(item) => `${item.title} ${item.message} ${item.visit?.visitCode ?? ""}`}
      placeholder="Search notifications…"
      empty="No notifications."
    >
      {(rows) => (
        <div className="space-y-2">
          {rows.map((item) => (
            <div key={item.id} className={`rounded-[10px] border border-[var(--line)] bg-white p-4 ${item.read ? "" : "border-[var(--line-strong)]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium">{item.title}</div>
                  <div className="mt-1 text-[13px] text-[var(--muted)]">{item.message}</div>
                  <div className="mt-2 text-[12px] text-[var(--faint)]">
                    {fmtDateTime(item.createdAt)} · {item.channel}
                    {item.visit ? (
                      <>
                        {" · "}
                        <Link href={`/visits/${item.visit.id}`} className="underline">
                          {item.visit.visitCode}
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
                {!item.read ? (
                  <form action={onRead.bind(null, item.id)}>
                    <button className="text-[12px] text-[var(--muted)]">Mark read</button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </PagedList>
  );
}

export function SecurityQueue({
  visits,
}: {
  visits: {
    id: string;
    visitCode: string;
    purpose: string;
    status: string;
    type: string;
    qrCheckInRequired: boolean;
    expectedArrival: Date | string;
    checkInAt?: Date | string | null;
    checkOutAt?: Date | string | null;
    host: { name: string };
    department: { name: string };
    vehicles?: { plate: string; vehicleType: string | null; parkingSlot: string | null }[];
    visitors: { visitor: { fullName: string; company: string | null; mobile: string } }[];
    approvals: { requiredRole: string; status: string; stepName: string; assignee?: { name: string; department?: { name: string } | null } | null }[];
  }[];
}) {
  return (
    <PagedList
      items={visits}
      searchText={(visit) => `${visit.visitCode} ${visit.purpose} ${visit.host.name} ${visit.department.name} ${visit.visitors[0]?.visitor.fullName} ${visit.visitors[0]?.visitor.mobile} ${visit.visitors[0]?.visitor.company}`}
      placeholder="Search visitor, host, visit…"
      empty="No visitors in this queue."
    >
      {(rows) => (
        <div className="space-y-2">
          {rows.map((visit) => {
            const visitor = visit.visitors[0]?.visitor;
            const banner = authorizationBanner(visit.status);
            const car = visit.vehicles?.[0];
            return (
              <Link key={visit.id} href={`/visits/${visit.id}`} className="block rounded-[10px] border border-[var(--line)] bg-white p-4 hover:border-[var(--line-strong)]">
                <div className={`auth-banner ${banner.tone} mb-3`}>{banner.label}</div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Visitor</div>
                    <div className="font-medium">{visitor?.fullName}</div>
                    <div className="text-[12px] text-[var(--muted)]">{visitor?.company || visitor?.mobile}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Host</div>
                    <div className="font-medium">{visit.host.name}</div>
                    <div className="text-[12px] text-[var(--muted)]">{visit.department.name}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Purpose</div>
                    <div className="font-medium">{visit.purpose}</div>
                    <div className="text-[12px] text-[var(--muted)]">
                      {fmtTime(visit.expectedArrival)} · {typeLabel(visit.type)}
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--muted)]">
                      {car?.plate && car.plate !== "UNPLATED" ? car.plate : "No vehicle"}
                      {car?.parkingSlot ? ` · ${car.parkingSlot}` : ""}
                      {visit.checkInAt ? ` · In ${fmtTime(visit.checkInAt)}` : ""}
                      {visit.checkOutAt ? ` · Out ${fmtTime(visit.checkOutAt)}` : ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Approval</div>
                    <ApprovalSummary visit={visit} />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[12px] text-[var(--muted)]">{visit.visitCode}</span>
                      <span className="flex items-center gap-2">
                        <span className={`need-pill ${visit.qrCheckInRequired ? "bg-[#e8f6ee] text-[#1f7a4d]" : "bg-[#f8f1de] text-[#9a6b12]"}`}>
                          {visit.qrCheckInRequired ? "QR" : "Manual"}
                        </span>
                        <StatusPill status={visit.status} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PagedList>
  );
}

export function InsidePeek({
  visits,
}: {
  visits: {
    id: string;
    status: string;
    checkInAt: Date | string | null;
    host: { name: string };
    visitors: { visitor: { fullName: string } }[];
  }[];
}) {
  return (
    <PagedList
      items={visits}
      pageSize={6}
      searchText={(visit) => `${visit.visitors[0]?.visitor.fullName} ${visit.host.name}`}
      placeholder="Search who is inside…"
      empty="No visitors are inside Headquarters."
    >
      {(rows) => (
        <div className="divide-y divide-[var(--line)]">
          {rows.map((visit) => (
            <Link key={visit.id} href={`/visits/${visit.id}`} className="block px-4 py-3 hover:bg-white/80">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium">{visit.visitors[0]?.visitor.fullName}</div>
                  <div className="text-[12px] text-[var(--muted)]">
                    {visit.host.name} · in since {fmtTime(visit.checkInAt)}
                  </div>
                </div>
                <StatusPill status={visit.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </PagedList>
  );
}

export function FrequentList({
  visitors,
}: {
  visitors: { id: string; fullName: string; _count: { visitLinks: number } }[];
}) {
  return (
    <PagedList
      items={visitors}
      pageSize={8}
      searchText={(visitor) => visitor.fullName}
      placeholder="Search frequent visitors…"
      empty="No frequent visitors."
    >
      {(rows) => (
        <div className="space-y-2 text-[13px]">
          {rows.map((visitor) => (
            <div key={visitor.id} className="flex justify-between rounded-xl bg-white/70 px-3 py-2">
              <span>{visitor.fullName}</span>
              <span className="text-[var(--muted)]">{visitor._count.visitLinks} visits</span>
            </div>
          ))}
        </div>
      )}
    </PagedList>
  );
}

export function HospitalityList({
  visits,
}: {
  visits: {
    id: string;
    visitCode: string;
    status: string;
    host: { name: string };
    visitDate: Date | string;
    expectedArrival: Date | string;
    fromAbroad: boolean;
    oneTimeVisit: boolean;
    qrCheckInRequired: boolean;
    originCity: string | null;
    originCountry: string | null;
    stayNights: number | null;
    flightArrival: string | null;
    hotelRequired: boolean;
    hotelBookingStatus: string | null;
    hotelName: string | null;
    pickupRequired: boolean;
    pickupType: string | null;
    dropoffRequired: boolean;
    mealBreakfast: boolean;
    mealLunch: boolean;
    mealDinner: boolean;
    visitors: { visitor: { fullName: string } }[];
    pills: string[];
  }[];
}) {
  return (
    <PagedList
      items={visits}
      searchText={(visit) => `${visit.visitors[0]?.visitor.fullName} ${visit.visitCode} ${visit.host.name} ${visit.pills.join(" ")}`}
      placeholder="Search guest, host, service…"
      empty="No hospitality requests right now."
    >
      {(rows) => (
        <div className="space-y-3">
          {rows.map((visit) => (
            <Link key={visit.id} href={`/visits/${visit.id}`} className="block rounded-[10px] border border-[var(--line)] bg-white p-4 hover:border-[var(--brand)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-medium">{visit.visitors[0]?.visitor.fullName}</div>
                  <div className="text-[13px] text-[var(--muted)]">
                    {visit.visitCode} · {visit.host.name} · {fmtDate(visit.visitDate)} {fmtTime(visit.expectedArrival)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {visit.pills.map((pill) => (
                      <span key={pill} className="need-pill bg-[#f4ecec] text-[var(--ink)]">
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
                <StatusPill status={visit.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </PagedList>
  );
}
