import { DisplayKiosk } from "@/components/display-kiosk";
import { requireSession } from "@/lib/auth";
import { DEFAULT_WELCOME, previewDisplay } from "@/lib/display";
import { canManageIntake } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const metadata = { title: "Welcome preview" };

export default async function DisplayPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  const session = await requireSession();
  if (!session || !canManageIntake(session.role)) redirect("/login");
  const { screen } = await searchParams;
  const view = await previewDisplay(screen);

  return (
    <DisplayKiosk
      room={view.roomLabel}
      sizeInches={view.screen.sizeInches}
      message={view.setup?.message || DEFAULT_WELCOME}
      imagePath={view.setup?.imagePath || null}
    />
  );
}
