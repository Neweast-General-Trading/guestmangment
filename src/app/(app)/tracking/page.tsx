import {
  TrackingActivity,
  TrackingFilters,
  TrackingInbox,
  TrackingKpis,
  TrackingPager,
  TrackingParking,
  TrackingRooms,
  TrackingServices,
  TrackingTabs,
  TrackingVisits,
} from "@/components/tracking-board";
import { Button, PageHeader } from "@/components/ui";
import { canSeeTracking } from "@/lib/access";
import { requireSession } from "@/lib/auth";
import { paginate } from "@/lib/paging";
import {
  loadTracking,
  parseTrackingPage,
  parseTrackingPageSize,
  trackingHref,
  trackingTab,
} from "@/lib/tracking";
import { redirect } from "next/navigation";

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    tab?: string;
    status?: string;
    origin?: string;
    room?: string;
    booker?: string;
    kind?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canSeeTracking(session.email)) redirect("/dashboard");
  const query = await searchParams;
  const tab = trackingTab(query.tab);
  const pageSize = parseTrackingPageSize(query.pageSize);
  const filters = {
    tab,
    q: query.q,
    from: query.from,
    to: query.to,
    status: query.status,
    origin: query.origin,
    room: query.room,
    booker: query.booker,
    kind: query.kind,
    pageSize,
  };
  const data = await loadTracking(filters);
  const page = parseTrackingPage(query.page);
  const exportHref = `/api/tracking/export${trackingHref({ ...filters, tab }).replace("/tracking", "")}`;

  function board() {
    if (tab === "rooms") {
      const view = paginate(data.rooms, page, pageSize);
      return { node: <TrackingRooms rooms={view.rows} />, view };
    }
    if (tab === "parking") {
      const view = paginate(data.parking, page, pageSize);
      return { node: <TrackingParking parking={view.rows} />, view };
    }
    if (tab === "services") {
      const view = paginate(data.services, page, pageSize);
      return { node: <TrackingServices services={view.rows} />, view };
    }
    if (tab === "activity") {
      const view = paginate(data.activity, page, pageSize);
      return { node: <TrackingActivity activity={view.rows} />, view };
    }
    if (tab === "inbox") {
      const view = paginate(data.inbox, page, pageSize);
      return { node: <TrackingInbox inbox={view.rows} />, view };
    }
    const view = paginate(data.visits, page, pageSize);
    return { node: <TrackingVisits visits={view.rows} />, view };
  }

  const { node, view } = board();

  return (
    <div>
      <PageHeader
        title="Tracking analysis"
        description="All staff. Every visit, Outlook room booking, parking bay, service, inbox mail, and desk action — not only your own."
        actions={
          <Button href={exportHref} variant="secondary">
            Export CSV
          </Button>
        }
      />
      <TrackingKpis summary={data.summary} />
      <TrackingTabs tab={tab} query={filters} />
      <TrackingFilters tab={tab} defaults={filters} roomNames={data.roomNames} bookers={data.bookers} />
      {node}
      <TrackingPager query={filters} page={view.page} pages={view.pages} total={view.total} pageSize={pageSize} />
    </div>
  );
}
