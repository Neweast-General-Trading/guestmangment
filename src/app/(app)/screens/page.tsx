import { ScreenSetupForm } from "@/components/screen-setup-form";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { draftDisplaySetup, liveDisplaySetup, listDisplayMedia, listDisplayScreens, setupLooksSame } from "@/lib/display";
import { canManageIntake } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; prepared?: string; published?: string; added?: string }>;
}) {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageIntake(session.role)) redirect("/dashboard");

  const query = await searchParams;
  const screens = await listDisplayScreens();
  const [draft, live, gallery] = await Promise.all([draftDisplaySetup(), liveDisplaySetup(), listDisplayMedia()]);

  return (
    <div className="overflow-x-hidden">
      <PageHeader
        title="Screen setup"
        description="Upload a landscape photo, choose the screens, then publish."
      />
      {query.error ? (
        <p className="mb-4 rounded-md border border-[#ead8d8] bg-[var(--tint-peach)] px-3 py-2 text-[13px] text-[var(--brand-ink)]">
          {query.error}
        </p>
      ) : null}
      {query.prepared ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          Prepared. The screens still show the last published welcome until you press Publish.
        </p>
      ) : null}
      {query.published ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          Published. The welcome is now on the screens.
        </p>
      ) : null}
      {query.added ? (
        <p className="mb-4 rounded-md border border-[#d7e6da] bg-[var(--tint-sage)] px-3 py-2 text-[13px]">
          Extra screen added. Include it when you prepare, then publish.
        </p>
      ) : null}
      <ScreenSetupForm
        screens={screens}
        gallery={gallery}
        draft={draft}
        live={live}
        canPublish={Boolean(draft && live && !setupLooksSame(draft, live)) || Boolean(draft && !live)}
      />
    </div>
  );
}
