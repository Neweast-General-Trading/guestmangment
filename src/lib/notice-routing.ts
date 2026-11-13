/**
 * Where each notification goes.
 *
 * Every notification is stored in the app and posted to Teams with full detail.
 * Email is kept for the essentials only — something the person must act on, or a final
 * status they must not miss — and goes once per person, per visit, per kind.
 * Calendar invitations (.ics) are separate and unchanged: they already carry the
 * confirmed room and time, so "visit confirmed" notices no longer repeat them by email.
 */

/** Essential notices: Teams + one email per person/visit/kind. */
export const EMAIL_NOTICE_TYPES = new Set<string>([
  // Someone has to act
  "APPROVAL_REQUIRED",
  "ESCALATION_REQUIRED",
  "INFO_REQUESTED",
  "BUILDING_TOUR",
  "GIFT_REQUEST",
  "GATE_PASS_REQUEST",
  "DRIVER_NEEDED",
  "INTAKE_READY",
  "SECURITY_DESK",
  "VISITOR_WAITING_AT_GATE",
  // Final status nobody should miss
  "VISIT_CANCELLED",
  "VISIT_REJECTED",
  "VISIT_DECLINED",
]);

export function emailsNotice(type: string) {
  return EMAIL_NOTICE_TYPES.has(type);
}
