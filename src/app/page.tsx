import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : "/login");
}
