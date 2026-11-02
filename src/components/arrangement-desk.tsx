import {
  approveGatePassAction,
  approveGiftAction,
  completeDriverAction,
  completeGatePassAction,
  completeGiftAction,
} from "@/app/actions";
import { ArrangementPill } from "@/components/arrangement-status";
import { FormBusy } from "@/components/form-busy";
import { Button, Card, Textarea } from "@/components/ui";

type VisitBits = {
  id: string;
  driverRequired: boolean;
  driverStatus: string | null;
  driverNote: string | null;
  driverName: string | null;
  giftRequired: boolean;
  giftType: string | null;
  giftStatus: string | null;
  giftNote: string | null;
  gatePassRequired: boolean;
  gatePassStatus: string | null;
  gatePassNote: string | null;
};

export function ArrangementDesk({
  visit,
  canComplete,
  canCompleteDriver = false,
  canApprove,
  canApprovePass = false,
  from = "intake",
  showDriver = true,
  showGift = true,
  showPass = true,
}: {
  visit: VisitBits;
  canComplete: boolean;
  canCompleteDriver?: boolean;
  canApprove: boolean;
  canApprovePass?: boolean;
  from?: "intake" | "gifts" | "passes" | "drivers";
  showDriver?: boolean;
  showGift?: boolean;
  showPass?: boolean;
}) {
  if (!visit.driverRequired && !visit.giftRequired && !visit.gatePassRequired) return null;

  return (
    <div className={`grid gap-3 lg:grid-cols-2 ${from === "intake" ? "mb-5" : ""}`}>
      {showDriver && visit.driverRequired ? (
        <Card tone={visit.driverStatus === "DONE" ? "sage" : "sand"}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Driver and car</div>
            <ArrangementPill status={visit.driverStatus} />
          </div>
          <p className="mt-2 text-[13px] text-[var(--muted)]">
            Sachini contacts the driver and confirms the trip. The requester sees the update when it is confirmed.
          </p>
          {visit.driverName ? <p className="mt-2 text-[13px]">Driver on file: {visit.driverName}</p> : null}
          {visit.driverNote ? <p className="mt-2 whitespace-pre-wrap text-[13px]">{visit.driverNote}</p> : null}
          {canCompleteDriver && visit.driverStatus !== "DONE" ? (
            <form action={completeDriverAction} className="mt-3 space-y-2">
              <FormBusy label="Saving driver…" />
              <input type="hidden" name="visitId" value={visit.id} />
              <input type="hidden" name="from" value={from} />
              <Textarea name="note" required placeholder="Contacted the driver and confirmed the trip." className="min-h-20" />
              <Button type="submit">Confirm driver</Button>
            </form>
          ) : null}
        </Card>
      ) : null}

      {showGift && visit.giftRequired ? (
        <Card tone={visit.giftStatus === "DONE" ? "sage" : visit.giftStatus === "PREPARING" ? "sky" : "lilac"}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Protocol gift</div>
            <ArrangementPill status={visit.giftStatus} />
          </div>
          <p className="mt-2 text-[15px] font-medium">{visit.giftType || "Protocol gift"}</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {visit.giftStatus === "PENDING"
              ? "Waiting for Marketing to approve."
              : visit.giftStatus === "PREPARING"
                ? "Marketing is preparing this gift. Reception marks Done when it arrives."
                : "Received at Reception."}
          </p>
          {visit.giftNote ? <p className="mt-2 whitespace-pre-wrap text-[13px]">{visit.giftNote}</p> : null}
          {canApprove && visit.giftStatus === "PENDING" ? (
            <form action={approveGiftAction} className="mt-3 space-y-2">
              <FormBusy label="Approving gift…" />
              <input type="hidden" name="visitId" value={visit.id} />
              <input type="hidden" name="from" value={from} />
              <Textarea name="note" placeholder="Approved. Preparing the gift." className="min-h-16" />
              <Button type="submit">Approve · Preparing</Button>
            </form>
          ) : null}
          {canComplete && visit.giftStatus === "PREPARING" ? (
            <form action={completeGiftAction} className="mt-3 space-y-2">
              <FormBusy label="Saving gift…" />
              <input type="hidden" name="visitId" value={visit.id} />
              <input type="hidden" name="from" value={from} />
              <Textarea name="note" placeholder="Received at Reception." className="min-h-16" />
              <Button type="submit">Gift received · Done</Button>
            </form>
          ) : null}
        </Card>
      ) : null}

      {showPass && visit.gatePassRequired ? (
        <Card tone={visit.gatePassStatus === "DONE" ? "sage" : visit.gatePassStatus === "PREPARING" ? "sky" : "lilac"}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Gate pass</div>
            <ArrangementPill status={visit.gatePassStatus} />
          </div>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {visit.gatePassStatus === "PENDING"
              ? "Waiting for Reception to approve the gate pass."
              : visit.gatePassStatus === "PREPARING"
                ? "Reception is preparing the gate pass. Upload the file when it is ready."
                : "Gate pass file is ready."}
          </p>
          {visit.gatePassNote ? <p className="mt-2 whitespace-pre-wrap text-[13px]">{visit.gatePassNote}</p> : null}
          {canApprovePass && visit.gatePassStatus === "PENDING" ? (
            <form action={approveGatePassAction} className="mt-3 space-y-2">
              <FormBusy label="Approving gate pass…" />
              <input type="hidden" name="visitId" value={visit.id} />
              <input type="hidden" name="from" value={from} />
              <Textarea name="note" placeholder="Approved. Preparing the gate pass." className="min-h-16" />
              <Button type="submit">Approve · Preparing</Button>
            </form>
          ) : null}
          {canComplete && visit.gatePassStatus === "PREPARING" ? (
            <form action={completeGatePassAction} className="mt-3 space-y-2">
              <FormBusy label="Saving gate pass…" />
              <input type="hidden" name="visitId" value={visit.id} />
              <input type="hidden" name="from" value={from} />
              <input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required className="block w-full text-[13px]" />
              <Textarea name="note" placeholder="Gate pass uploaded." className="min-h-16" />
              <Button type="submit">Upload gate pass · Done</Button>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
