import { DisplayKiosk } from "@/components/display-kiosk";
import { DEFAULT_WELCOME, displayForPath } from "@/lib/display";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await displayForPath(token);
  return { title: view ? `${view.roomLabel} · Welcome screen` : "Welcome screen" };
}

export default async function DisplayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await displayForPath(token);
  if (!view) notFound();

  return (
    <DisplayKiosk
      room={view.roomLabel}
      sizeInches={view.screen.sizeInches}
      message={view.setup?.message || DEFAULT_WELCOME}
      imagePath={view.setup?.imagePath || null}
    />
  );
}
