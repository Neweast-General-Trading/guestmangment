import { VISIT_STATUSES, VISIT_TYPES, VISIT_TYPE_LABEL, STATUS_LABEL } from "@/lib/constants";
import { inputClass } from "@/components/ui";
import { SearchSelect } from "@/components/search-select";

export function VisitFilters({
  departments,
  action = "",
  defaults,
}: {
  departments: { id: string; name: string }[];
  action?: string;
  defaults?: { q?: string; status?: string; type?: string; departmentId?: string; from?: string; to?: string };
}) {
  return (
    <form action={action} className="mb-4 grid gap-2 rounded-[10px] border border-[var(--line)] bg-white p-3 md:grid-cols-6">
      <input
        name="q"
        defaultValue={defaults?.q}
        placeholder="Search name, mobile, company, visit ID"
        className={`${inputClass} md:col-span-2`}
      />
      <select name="status" defaultValue={defaults?.status ?? ""} className={inputClass}>
        <option value="">All statuses</option>
        {VISIT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status]}
          </option>
        ))}
      </select>
      <select name="type" defaultValue={defaults?.type ?? ""} className={inputClass}>
        <option value="">All types</option>
        {VISIT_TYPES.map((type) => (
          <option key={type} value={type}>
            {VISIT_TYPE_LABEL[type]}
          </option>
        ))}
      </select>
      <SearchSelect
        name="departmentId"
        defaultValue={defaults?.departmentId ?? ""}
        placeholder="Search department"
        options={[{ value: "", label: "All departments" }, ...departments.map((dept) => ({ value: dept.id, label: dept.name }))]}
      />
      <div className="grid grid-cols-2 gap-2 md:col-span-6 lg:col-span-1 lg:grid-cols-1">
        <button className="h-9 rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] text-[13px] font-medium text-[var(--brand-ink)]" type="submit">
          Filter
        </button>
      </div>
      <input type="date" name="from" defaultValue={defaults?.from} className={inputClass} />
      <input type="date" name="to" defaultValue={defaults?.to} className={inputClass} />
    </form>
  );
}
