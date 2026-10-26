import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requireSession } from "@/lib/auth";
import { applyLifecycle } from "@/lib/lifecycle";
import type { Role } from "@/lib/constants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect("/login");
  await applyLifecycle();
  const pathname = (await headers()).get("x-pathname") || "/dashboard";

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
