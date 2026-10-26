"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SyncState = {
  ok: boolean;
  scanned: number;
  created: number;
  replies: number;
  reason?: string;
  at: number;
};

export function InboxAutoSync() {
  const router = useRouter();
  const busy = useRef(false);
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && /[?&](synced|scanned|replies)=/.test(window.location.search)) {
      router.replace("/intake");
    }

    async function run() {
      if (busy.current) return;
      busy.current = true;
      try {
        const res = await fetch("/api/inbox/sync", { method: "POST", credentials: "same-origin" });
        const data = (await res.json()) as SyncState;
        setState({ ...data, at: Date.now() });
        if (data.ok) router.refresh();
      } catch {
        setState({ ok: false, scanned: 0, created: 0, replies: 0, reason: "Inbox sync failed.", at: Date.now() });
      } finally {
        busy.current = false;
      }
    }

    run();
    const timer = window.setInterval(run, 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  if (!state) {
    return (
      <p className="mb-4 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--muted)]">
        Syncing inbox…
      </p>
    );
  }
  if (!state.ok) {
    return (
      <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
        {state.reason || "Inbox sync failed."}
      </p>
    );
  }
  return (
    <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
      Inbox scanned {state.scanned} messages. {state.created} new request{state.created === 1 ? "" : "s"} created.
      {state.replies ? ` ${state.replies} meeting-room ${state.replies === 1 ? "reply" : "replies"} noted.` : ""}
      {" "}Auto-sync every minute.
    </p>
  );
}
