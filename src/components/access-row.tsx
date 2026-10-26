import { updateUserAccessAction } from "@/app/actions";
import { ACCESS_GROUP_LABEL, ACCESS_GROUPS, ASSIGNABLE_ROLES } from "@/lib/access";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { inputClass } from "@/components/ui";

export function AccessRow({
  person,
  group,
  q,
  page,
  pageSize,
}: {
  person: {
    id: string;
    name: string;
    email: string;
    role: string;
    jobTitle: string | null;
    accessGroup: string | null;
    departmentName: string | null;
    nature: string;
  };
  group: string;
  q: string;
  page: number;
  pageSize: number;
}) {
  return (
    <form action={updateUserAccessAction} className="grid gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
      <input type="hidden" name="userId" value={person.id} />
      <input type="hidden" name="group" value={group} />
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="page" value={page} />
      <input type="hidden" name="pageSize" value={pageSize} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium">{person.name}</div>
        <div className="truncate text-[12px] text-[var(--muted)]">{person.email}</div>
        <div className="mt-0.5 truncate text-[12px] text-[var(--faint)]">
          {[person.departmentName, person.jobTitle].filter(Boolean).join(" · ") || "No department"}
        </div>
        <div className="mt-1 text-[12px] text-[var(--muted)]">{person.nature}</div>
      </div>
      <label className="block">
        <span className="mb-1 block text-[11px] text-[var(--faint)] md:hidden">Role</span>
        <select name="role" className={inputClass} defaultValue={person.role}>
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role as Role]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-[var(--faint)] md:hidden">Access</span>
        <select name="accessGroup" className={inputClass} defaultValue={person.accessGroup || ""}>
          <option value="">No access</option>
          {ACCESS_GROUPS.map((item) => (
            <option key={item} value={item}>
              {ACCESS_GROUP_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--line)] bg-white px-3 text-[12px] font-medium hover:bg-[#faf4f4]"
      >
        Save
      </button>
    </form>
  );
}
