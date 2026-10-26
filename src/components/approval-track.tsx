import { StatusPill } from "@/components/status";
import { approvalDesk, approvalState, STEP_STATUS_LABEL } from "@/lib/approval-state";

type VisitLike = Parameters<typeof approvalState>[0];

export function ApprovalSummary({ visit }: { visit: VisitLike }) {
  const state = approvalState(visit);
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{state.desk}</div>
      <div className="truncate text-[12px] text-[var(--muted)]">
        {STEP_STATUS_LABEL[state.status] ?? state.label}
        {state.label !== "All steps approved" && state.status !== "DRAFT" ? ` · ${state.label}` : ""}
      </div>
    </div>
  );
}

export function ApprovalTrack({ visit }: { visit: VisitLike }) {
  const state = approvalState(visit);
  if (!visit.approvals.length) {
    return <p className="text-[13px] text-[var(--muted)]">{state.label}.</p>;
  }

  return (
    <div className="min-w-0">
      <p className="mb-3 text-[12px] leading-5 text-[var(--muted)]">
        {state.status === "APPROVED" && !state.current
          ? "All steps approved."
          : `Now at ${state.desk} · ${STEP_STATUS_LABEL[state.status] ?? state.status}`}
      </p>
      <ol className="min-w-0">
        {visit.approvals.map((step, index) => {
          const desk = approvalDesk(step, visit);
          const active = step.status === "PENDING" || step.status === "INFO_REQUESTED";
          const last = index === visit.approvals.length - 1;
          return (
            <li key={`${step.stepName}-${step.requiredRole}-${step.status}`} className="flex min-w-0 gap-2.5">
              <div className="flex w-3 shrink-0 flex-col items-center">
                <span
                  className={`mt-1.5 h-2 w-2 rounded-full ${
                    step.status === "APPROVED"
                      ? "bg-[#2d7a55]"
                      : active
                        ? "bg-[var(--brand)]"
                        : "bg-[#d4c4c4]"
                  }`}
                />
                {last ? null : <span className="mt-1 w-px flex-1 bg-[var(--line)]" />}
              </div>
              <div className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-3"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium leading-5">{step.stepName}</div>
                    <div className="truncate text-[12px] leading-4 text-[var(--muted)]">{desk}</div>
                  </div>
                  <StatusPill status={step.status === "PENDING" ? "PENDING_APPROVAL" : step.status} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
