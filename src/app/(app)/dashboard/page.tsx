import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";

export default async function DashboardPage() {
  const session = await requireSession();
  if (!session) return null;
  redirect(homeFor(session.role));
}
