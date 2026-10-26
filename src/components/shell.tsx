import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { NeweastLogo } from "@/components/logo";
import { homeFor, navGroupsFor } from "@/lib/permissions";
import { APP_NAME, ROLE_LABEL, type Role } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { Bell, LogOut } from "lucide-react";

export async function AppShell({
  children,
  user,
  pathname,
}: {
  children: React.ReactNode;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    departmentName?: string | null;
    accessGroup?: string | null;
  };
  pathname: string;
}) {
  const unread = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });
  const groups = navGroupsFor(user.role, user.email, user.accessGroup);

  return (
    <div className="min-h-full bg-[var(--bg)]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] border-r border-[#ead8d8] bg-[var(--tint-mint)] md:flex md:flex-col">
        <div className="border-b border-[#ead8d8] px-5 py-4">
          <Link href={homeFor(user.role)} className="block">
            <NeweastLogo className="w-[168px]" priority />
            <div className="mt-2 text-[13px] font-medium tracking-tight text-[var(--ink)]">{APP_NAME}</div>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 pr-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--faint)]">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mb-0.5 flex h-8 items-center rounded-md px-2 text-[13px] ${
                      active ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "text-[var(--ink)] hover:bg-[#faf4f4]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--line)] p-4">
          <div className="text-[13px] font-medium">{user.name}</div>
          <div className="text-[11px] text-[var(--muted)]">{ROLE_LABEL[user.role]}</div>
        </div>
      </aside>

      <div className="md:pl-[248px]">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#ead8d8] bg-white/90 px-4 backdrop-blur md:px-6">
          <div className="md:hidden">
            <NeweastLogo className="w-[120px]" />
            <div className="text-[12px] font-medium text-[var(--muted)]">{APP_NAME}</div>
          </div>
          <div className="hidden text-[13px] text-[var(--muted)] md:block">
            {groups[0]?.label || "Guest Management"}
            {user.departmentName ? ` · ${user.departmentName}` : ""}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              aria-label={unread ? `${unread} unread notifications` : "Notifications"}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[#faf4f4] hover:text-[var(--ink)]"
            >
              <Bell size={15} strokeWidth={1.75} />
              {unread ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[9px] font-medium text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <form action={logoutAction}>
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2.5 text-[12px] text-[var(--muted)] hover:bg-[#faf4f4] hover:text-[var(--ink)]"
                type="submit"
              >
                <LogOut size={13} strokeWidth={1.75} />
                Sign out
              </button>
            </form>
          </div>
        </header>
        <div className="border-b border-[var(--line)] bg-white px-3 py-2 md:hidden">
          <div className="flex gap-1 overflow-x-auto">
            {groups.flatMap((group) => group.items).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex h-11 shrink-0 items-center rounded-lg px-3 text-[13px] whitespace-nowrap ${
                    active ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-ink)]" : "text-[var(--muted)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <main className="px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
