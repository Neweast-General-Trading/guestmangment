import { notFound } from "next/navigation";
import {
  arriveAction,
  cancelVisitAction,
  checkInAction,
  checkOutAction,
  decideAction,
  inMeetingAction,
  inviteAction,
  saveVehicleAction,
  submitVisitAction,
  updateServiceTaskAction,
  verifyAction,
} from "@/app/actions";
import { ApprovalTrack } from "@/components/approval-track";
import { QrCard } from "@/components/qr-card";
import { StatusPill, TypeTag } from "@/components/status";
import { Button, Card, PageHeader, TextInput, Textarea } from "@/components/ui";
import { ParkingSlotField } from "@/components/parking-slot-field";
import { VisitForm } from "@/components/visit-form";
import { GATES } from "@/lib/constants";
import { datetimeLocal } from "@/lib/visit-schedule";
import { requireSession } from "@/lib/auth";
import { fmtDate, fmtDateTime, fmtDuration, fmtTime, liveDuration, maskId, typeLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { meetingRoomOptions } from "@/lib/graph";
import { lookups } from "@/lib/queries";
import { canAssignParking, canDecideApproval, canOperateGate, canSeeIdentity, canSeeInternalNotes } from "@/lib/permissions";
import { primaryVisitor, sanitizeVisit, visitInclude } from "@/lib/visits";
import { hasHospitality, mealSummary } from "@/lib/hospitality";
import { checkInModeLabel, needLabel, selectedFromVisit } from "@/lib/guest-needs";
import { TASK_STATUSES } from "@/lib/service-master";

export default async function VisitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  const { id } = await params;
  const { error } = await searchParams;
  const raw = await prisma.visit.findUnique({ where: { id }, include: visitInclude });
  if (!raw) notFound();
  const visit = sanitizeVisit(raw, session.role);
  const visitor = primaryVisitor(visit);
  const [{ hosts, departments, catalog }, rooms] = await Promise.all([lookups(), meetingRoomOptions()]);
  const catalogLabel = Object.fromEntries(catalog.map((item) => [item.code, item.label]));
  const pendingStep = visit.approvals.find((step) => step.status === "PENDING");
  const canDecide = pendingStep
    ? canDecideApproval(session.role, pendingStep.requiredRole, {
        actorId: session.id,
        assigneeId: pendingStep.assigneeId,
        hostId: visit.hostId,
        createdById: visit.createdById,
      })
    : false;
  const intakeOpen = (visit.source === "EMAIL" || visit.source === "STAFF") && ["INTAKE", "ESCALATED"].includes(visit.status);
  const canEdit = ["DRAFT", "PENDING_APPROVAL"].includes(visit.status) && !visit.checkInAt && !intakeOpen;
  const showIdentity = canSeeIdentity(session.role);
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invite/${visit.qrToken}`;
  const guestNeeds = selectedFromVisit(visit);

  const closed = ["COMPLETED", "CHECKED_OUT", "CANCELLED", "NO_SHOW", "REJECTED", "EXPIRED", "ACCESS_DENIED"];
  const canCancel = !closed.includes(visit.status) && !visit.checkInAt;
  const canPark = canAssignParking(session.role, { actorId: session.id, hostId: visit.hostId });
  const hasActions =
    visit.status === "DRAFT" ||
    (visit.status === "PENDING_APPROVAL" && canDecide) ||
    visit.status === "APPROVED" ||
    canOperateGate(session.role) ||
    canCancel ||
    canPark;

  return (
    <div>
      <PageHeader
        title={visit.visitCode}
        description={`${visitor?.fullName ?? "Visitor"} · ${visit.host.name} · ${visit.department.name}`}
      />
      {error ? <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">{error}</p> : null}
      {intakeOpen ? (
        <p className="mb-4 rounded-md border border-[#d6e2ee] bg-[var(--tint-sky)] px-3 py-2 text-[13px]">
          This request is still on Email intake.{" "}
          <a href={`/intake/${visit.id}`} className="font-medium text-[var(--brand-ink)]">
            Open the intake desk
          </a>
          .
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Info label="Visitor" value={visitor?.fullName} extra={visitor?.company} />
              <Info label="Mobile" value={visitor?.mobile} extra={visitor?.email} />
              <Info label="Host" value={visit.host.name} extra={visit.host.jobTitle} />
              <Info label="Department" value={visit.department.name} extra={visit.location} />
              <Info label="Purpose" value={visit.purpose} extra={visit.description} />
              <Info
                label="Appointment"
                value={`${fmtDate(visit.visitDate)} · ${fmtTime(visit.expectedArrival)}`}
                extra={visit.expectedDeparture ? `Until ${fmtTime(visit.expectedDeparture)}` : undefined}
              />
              <Info label="Type" value={typeLabel(visit.type)} extra={visit.vip ? "VIP" : visit.accessArea} />
              <Info
                label="Meeting room"
                value={visit.meetingRoom || "No"}
                extra={`${visit.visitorCount} visitor(s)${visit.driverRequired ? " · Driver" : ""}${visit.giftRequired ? ` · Gift${visit.giftType ? ` (${visit.giftType})` : ""}` : ""}`}
              />
              {visit.vehicles[0] ? (
                <Info
                  label="Vehicle"
                  value={visit.vehicles[0].plate === "UNPLATED" ? visit.vehicles[0].vehicleType || "Unplated" : visit.vehicles[0].plate}
                  extra={[visit.vehicles[0].vehicleType, visit.vehicles[0].parkingSlot].filter(Boolean).join(" · ") || undefined}
                />
              ) : null}
              {visit.checkInAt || visit.checkOutAt ? (
                <Info
                  label="Gate times"
                  value={visit.checkInAt ? `In ${fmtDateTime(visit.checkInAt)}` : "Not in"}
                  extra={visit.checkOutAt ? `Out ${fmtDateTime(visit.checkOutAt)}` : undefined}
                />
              ) : null}
              {showIdentity ? (
                <Info
                  label="Identification"
                  value={visitor?.idType}
                  extra={visitor?.idReference}
                />
              ) : (
                <Info label="Identification" value={visitor?.idType} extra={maskId(visitor?.idReference)} />
              )}
              {canSeeInternalNotes(session.role) ? (
                <Info label="Internal notes" value={visit.internalNotes} extra={visit.specialRequirements} />
              ) : null}
              <Info
                label="Parking slot"
                value={visit.vehicles[0]?.parkingSlot || "Not assigned"}
                extra={visit.vehicles[0]?.plate && visit.vehicles[0].plate !== "UNPLATED" ? visit.vehicles[0].plate : undefined}
              />
              <Info
                label="Check-in"
                value={fmtDateTime(visit.checkInAt)}
                extra={visit.entryGate ? `${visit.entryGate} · ${visit.checkInBy?.name ?? ""}` : undefined}
              />
              <Info
                label="Check-out"
                value={fmtDateTime(visit.checkOutAt)}
                extra={
                  visit.checkOutAt
                    ? `${fmtDuration(visit.durationMinutes)} · ${visit.exitGate ?? ""}`
                    : visit.checkInAt
                      ? `Inside for ${liveDuration(visit.checkInAt)}`
                      : undefined
                }
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <TypeTag type={visit.type}>{typeLabel(visit.type)}</TypeTag>
              {visit.fromAbroad ? <span className="need-pill bg-[var(--brand-soft)] text-[var(--brand-ink)]">From abroad</span> : null}
              {visit.oneTimeVisit ? <span className="need-pill bg-[#e8f1f8] text-[#1d4f7a]">One-time</span> : null}
              <span className={`need-pill ${visit.qrCheckInRequired ? "bg-[#e8f6ee] text-[#1f7a4d]" : "bg-[#f8f1de] text-[#9a6b12]"}`}>
                {checkInModeLabel(visit.qrCheckInRequired)}
              </span>
              {visit.badges[0] ? <TypeTag>{visit.badges[0].number}</TypeTag> : null}
              {visit.vehicles[0] ? <TypeTag>{visit.vehicles[0].plate}</TypeTag> : null}
              {visit.vehicles[0]?.parkingSlot ? <TypeTag>{`Slot ${visit.vehicles[0].parkingSlot}`}</TypeTag> : null}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-medium">Guest needs</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Info
                label="Gate"
                value={checkInModeLabel(visit.qrCheckInRequired)}
                extra={
                  visit.qrCheckInRequired
                    ? "Guard asks the guest to present the invitation QR"
                    : "Guard records entry and exit on this visit — no QR scan"
                }
              />
              <Info
                label="Visit"
                value={[visit.oneTimeVisit ? "One-time" : null, visit.fromAbroad ? "From abroad" : "Local"].filter(Boolean).join(" · ")}
                extra={visit.fromAbroad ? [visit.originCity, visit.originCountry].filter(Boolean).join(", ") || undefined : undefined}
              />
              {visit.fromAbroad ? <Info label="Flights" value={visit.flightArrival} extra={visit.flightDeparture} /> : null}
              {visit.hotelRequired ? (
                <Info
                  label="Hotel"
                  value={visit.hotelName || "Hotel requested"}
                  extra={[visit.hotelBookingStatus, visit.hotelRoomType, visit.stayNights ? `${visit.stayNights} night(s)` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ) : null}
              {visit.pickupRequired || visit.dropoffRequired ? (
                <Info
                  label="Transfer"
                  value={visit.pickupRequired ? `Pickup · ${visit.pickupType || "car"}` : "Drop-off"}
                  extra={[visit.pickupFrom, visit.pickupTime, visit.dropoffRequired ? "Drop-off required" : ""]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ) : null}
              {hasHospitality(visit) && (visit.mealBreakfast || visit.mealLunch || visit.mealDinner) ? (
                <Info label="Meals" value={mealSummary(visit)} extra={visit.dietaryNeeds} />
              ) : null}
              <Info label="Other notes" value={visit.hospitalityNotes} />
            </div>
            {visit.serviceTasks?.length ? (
              <ul className="mt-4 space-y-3">
                {visit.serviceTasks.map((task) => {
                  const status = TASK_STATUSES.find((item) => item.code === task.status)?.label || task.status;
                  const canUpdate =
                    session.role === "SYSTEM_ADMIN" || task.service.owners.some((owner) => owner.userId === session.id);
                  return (
                    <li key={task.id} className="rounded-xl border border-[var(--line)] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-[13px] font-medium">{task.service.label}</div>
                          <div className="text-[12px] text-[var(--muted)]">
                            {task.service.owners.map((owner) => owner.user.name).join(", ") || "No owner"}
                          </div>
                          {task.requesterNotes ? <p className="mt-1 text-[12px]">{task.requesterNotes}</p> : null}
                        </div>
                        <span className="need-pill bg-[var(--brand-soft)] text-[var(--brand-ink)]">{status}</span>
                      </div>
                      {task.updates.length ? (
                        <ol className="mt-2 space-y-1 border-t border-[var(--line)] pt-2">
                          {task.updates.map((item) => (
                            <li key={item.id} className="text-[12px] text-[var(--muted)]">
                              {fmtDateTime(item.createdAt)} · {item.user.name} · {TASK_STATUSES.find((row) => row.code === item.status)?.label || item.status}
                              {item.note ? ` — ${item.note}` : ""}
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      {canUpdate ? (
                        <form action={updateServiceTaskAction} className="mt-3 grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end">
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="from" value="visit" />
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
                            <TextInput name="note" placeholder="What changed?" />
                          </label>
                          <Button type="submit">Save</Button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : guestNeeds.length ? (
              <ul className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
                {guestNeeds.map((item) => (
                  <li key={item.code} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <span className="text-[13px] font-medium">{catalogLabel[item.code] || needLabel(item.code)}</span>
                    <span className="text-[12px] text-[var(--muted)]">{item.notes || "No notes"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-[var(--muted)]">No catalogue services selected.</p>
            )}
          </Card>

          {visit.visitors.length > 1 ? (
            <Card>
              <h2 className="mb-3 text-sm font-medium">Group visitors</h2>
              <div className="space-y-2 text-[13px]">
                {visit.visitors.map((link) => (
                  <div key={link.id} className="flex justify-between border-b border-[var(--line)] py-2 last:border-0">
                    <span>{link.visitor.fullName}</span>
                    <span className="text-[var(--muted)]">{link.visitor.company || link.visitor.mobile}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {canEdit ? (
            <div>
              <h2 className="mb-3 text-sm font-medium">Edit visit</h2>
              <VisitForm hosts={hosts} departments={departments} visit={raw} currentUserId={session.id} catalog={catalog} rooms={rooms} />
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-20">
          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_1px_0_rgba(20,32,31,0.03)]">
            <section className="px-4 py-3.5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--faint)]">Approval</h2>
                <StatusPill status={visit.status} />
              </div>
              <ApprovalTrack visit={visit} />
            </section>

            <section className="border-t border-[var(--line)] px-4 py-3.5">
              <h2 className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--faint)]">QR code</h2>
              <p className="mb-3 text-[12px] leading-5 text-[var(--muted)]">
                {visit.qrCheckInRequired
                  ? "Guest presents this at the gate for check-in."
                  : "Identification only. The guard records check-in and check-out on this page."}
              </p>
              <QrCard compact framed={false} value={inviteUrl || visit.qrToken} label={`${visit.visitCode}`} />
            </section>

            {hasActions ? (
              <section className="border-t border-[var(--line)] px-4 py-3.5">
                <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--faint)]">Actions</h2>
                <div className="space-y-2">
                  {visit.status === "DRAFT" ? (
                    <form action={submitVisitAction.bind(null, visit.id)}>
                      <Button type="submit" className="w-full">Submit for approval</Button>
                    </form>
                  ) : null}

                  {visit.status === "PENDING_APPROVAL" && canDecide ? (
                    <form action={decideAction} className="space-y-2">
                      <input type="hidden" name="visitId" value={visit.id} />
                      <Textarea name="comments" placeholder="Comment (optional)" />
                      <div className="grid grid-cols-2 gap-2">
                        <button name="decision" value="APPROVED" className="h-8 rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] text-[12px] font-medium text-[var(--brand-ink)]">
                          Approve
                        </button>
                        <button name="decision" value="REJECTED" className="h-8 rounded-md border border-[var(--line)] bg-white text-[12px]">
                          Reject
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {visit.status === "APPROVED" ? (
                    <form action={inviteAction} className="space-y-2">
                      <input type="hidden" name="visitId" value={visit.id} />
                      <input type="hidden" name="channel" value="EMAIL" />
                      <Button type="submit" className="w-full">Email invitation</Button>
                    </form>
                  ) : null}

                  {canOperateGate(session.role) ? (
                    <div className="space-y-2">
                      {["APPROVED", "INVITATION_SENT", "EXPECTED"].includes(visit.status) ? (
                        <form action={arriveAction.bind(null, visit.id)}>
                          <Button type="submit" variant="secondary" className="w-full">Mark arrived</Button>
                        </form>
                      ) : null}
                      {["APPROVED", "INVITATION_SENT", "EXPECTED", "ARRIVED", "WAITING_AT_GATE"].includes(visit.status) ? (
                        <form action={verifyAction.bind(null, visit.id)}>
                          <Button type="submit" variant="secondary" className="w-full">Verify visitor</Button>
                        </form>
                      ) : null}
                      {["APPROVED", "INVITATION_SENT", "EXPECTED", "ARRIVED", "SECURITY_VERIFICATION"].includes(visit.status) ? (
                        <form action={checkInAction} className="space-y-2">
                          <input type="hidden" name="visitId" value={visit.id} />
                          <select name="entryGate" className="h-8 w-full rounded-md border border-[var(--line)] px-2 text-[13px]">
                            {GATES.map((gate) => (
                              <option key={gate}>{gate}</option>
                            ))}
                          </select>
                          <TextInput name="vehiclePlate" placeholder="Vehicle plate" defaultValue={visit.vehicles[0]?.plate === "UNPLATED" ? "" : visit.vehicles[0]?.plate || ""} />
                          <select name="vehicleType" defaultValue={visit.vehicles[0]?.vehicleType || ""} className="h-8 w-full rounded-md border border-[var(--line)] px-2 text-[13px]">
                            <option value="">Vehicle type</option>
                            {["Sedan", "SUV", "Van", "Pickup", "Motorcycle", "Other"].map((item) => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                          <ParkingSlotField defaultValue={visit.vehicles[0]?.parkingSlot ?? ""} />
                          <label className="block">
                            <span className="mb-1 block text-[11px] text-[var(--muted)]">Entry time</span>
                            <TextInput type="datetime-local" name="checkInAt" defaultValue={datetimeLocal(visit.checkInAt) || datetimeLocal(new Date())} />
                          </label>
                          <Button type="submit" className="w-full">Check in</Button>
                        </form>
                      ) : null}
                      {["CHECKED_IN", "CURRENTLY_INSIDE", "IN_MEETING", "OVERDUE"].includes(visit.status) ? (
                        <>
                          <form action={inMeetingAction.bind(null, visit.id)}>
                            <Button type="submit" variant="secondary" className="w-full">In meeting</Button>
                          </form>
                          <form action={checkOutAction} className="space-y-2">
                            <input type="hidden" name="visitId" value={visit.id} />
                            <select name="exitGate" className="h-8 w-full rounded-md border border-[var(--line)] px-2 text-[13px]">
                              {GATES.map((gate) => (
                                <option key={gate}>{gate}</option>
                              ))}
                            </select>
                            <label className="block">
                              <span className="mb-1 block text-[11px] text-[var(--muted)]">Exit time</span>
                              <TextInput type="datetime-local" name="checkOutAt" defaultValue={datetimeLocal(new Date())} />
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                              <input type="checkbox" name="badgeReturned" defaultChecked />
                              Badge returned
                            </label>
                            <Button type="submit" className="w-full">Check out</Button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {canPark ? (
                    <form action={saveVehicleAction} className="space-y-2">
                      <input type="hidden" name="visitId" value={visit.id} />
                      <TextInput name="vehiclePlate" placeholder="Vehicle plate" defaultValue={visit.vehicles[0]?.plate === "UNPLATED" ? "" : visit.vehicles[0]?.plate || ""} />
                      <select name="vehicleType" defaultValue={visit.vehicles[0]?.vehicleType || ""} className="h-8 w-full rounded-md border border-[var(--line)] px-2 text-[13px]">
                        <option value="">Vehicle type</option>
                        {["Sedan", "SUV", "Van", "Pickup", "Motorcycle", "Other"].map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                      <ParkingSlotField defaultValue={visit.vehicles[0]?.parkingSlot ?? ""} />
                      <Button type="submit" variant="secondary" className="w-full">Save vehicle & parking</Button>
                    </form>
                  ) : null}

                  {canCancel ? (
                    <form action={cancelVisitAction} className="flex gap-2 pt-1">
                      <input type="hidden" name="visitId" value={visit.id} />
                      <TextInput name="reason" placeholder="Cancel reason" required />
                      <Button type="submit" variant="ghost">Cancel</Button>
                    </form>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="border-t border-[var(--line)]">
              <h2 className="px-4 pt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--faint)]">Timeline</h2>
              <ol className="max-h-64 overflow-y-auto py-1">
                {visit.timeline.length === 0 ? (
                  <li className="px-4 py-4 text-[13px] text-[var(--muted)]">No activity yet.</li>
                ) : (
                  visit.timeline.map((event) => (
                    <li key={event.id} className="flex gap-2.5 px-4 py-2">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium leading-5">{event.event}</div>
                        <div className="text-[12px] leading-4 text-[var(--muted)]">
                          {fmtDateTime(event.createdAt)}
                          {event.note ? ` · ${event.note}` : ""}
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ol>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value, extra }: { label: string; value?: string | null; extra?: string | null }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">{label}</div>
      <div className="mt-1 text-[13px] font-medium">{value || "—"}</div>
      {extra ? <div className="text-[12px] text-[var(--muted)]">{extra}</div> : null}
    </div>
  );
}
