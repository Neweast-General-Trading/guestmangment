import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requireSession } from "@/lib/auth";
import { applyLifecycle } from "@/lib/lifecycle";
import type { Role } from "@/lib/constants";
import { canOpenAppPath, homeFor } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await applyLifecycle();
  const pathname = (await headers()).get("x-pathname") || "/dashboard";
  if (!canOpenAppPath(session.role as Role, session.email, session.accessGroup, pathname)) {
    redirect(homeFor(session.role as Role));
  }

  return (
    <AppShell
      pathname={pathname}
      user={{
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role as Role,
        departmentName: session.departmentName,
        accessGroup: session.accessGroup,
      }}
    >
      {children}
    </AppShell>
  );
}
