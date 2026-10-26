"use client";

import { useState } from "react";
import { saveRuleAction } from "@/app/actions";
import { Button, Select } from "@/components/ui";
import { SearchSelect } from "@/components/search-select";
import { APPROVER_PRESETS, FORM_VISIT_TYPES, VISIT_TYPE_LABEL, VISITOR_CATEGORIES } from "@/lib/constants";

export function ApprovalRuleForm({
  departments,
}: {
  departments: { id: string; code: string; name: string }[];
}) {
  const [type, setType] = useState<(typeof FORM_VISIT_TYPES)[number]>("CUSTOMER");
  const [levels, setLevels] = useState<string[]>(["HOST_MANAGER", "SAMIR"]);

  function changeType(next: (typeof FORM_VISIT_TYPES)[number]) {
    setType(next);
    setLevels(next === "CUSTOMER" ? ["HOST_MANAGER", "SAMIR"] : ["MAIS"]);
  }

  return (
    <form action={saveRuleAction} className="space-y-3">
      <label className="block text-[12px] text-[var(--muted)]">Visit type</label>
      <Select name="visitType" value={type} onChange={(event) => changeType(event.target.value as typeof type)}>
        {FORM_VISIT_TYPES.map((item) => (
          <option key={item} value={item}>
            {VISIT_TYPE_LABEL[item]}
          </option>
        ))}
      </Select>
      <label className="block text-[12px] text-[var(--muted)]">Department</label>
      <SearchSelect
        name="departmentCode"
        defaultValue=""
        placeholder="Search department"
        options={[{ value: "", label: "All departments" }, ...departments.map((dept) => ({ value: dept.code, label: dept.name }))]}
      />
      <label className="block text-[12px] text-[var(--muted)]">Visitor category</label>
      <Select name="visitorCategory" defaultValue="">
        <option value="">All categories</option>
        {VISITOR_CATEGORIES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </Select>
      <div className="space-y-2">
        <div className="text-[12px] text-[var(--muted)]">Approval level</div>
        {levels.map((level, index) => (
          <Select
            key={`${index}-${level}`}
            name="level"
            defaultValue={level}
            onChange={(event) => {
              const next = [...levels];
              next[index] = event.target.value;
              setLevels(next);
            }}
          >
            {APPROVER_PRESETS.map((item) => (
              <option key={item.code} value={item.code}>
                Level {index + 1} · {item.label}
              </option>
            ))}
          </Select>
        ))}
        <div className="flex gap-2">
          <button
            type="button"
            className="text-[12px] text-[var(--brand-ink)]"
            onClick={() => setLevels((current) => [...current, current.length ? "SAMIR" : "MAIS"])}
          >
            Add level
          </button>
          {levels.length > 1 ? (
            <button type="button" className="text-[12px] text-[var(--muted)]" onClick={() => setLevels((current) => current.slice(0, -1))}>
              Remove last
            </button>
          ) : null}
        </div>
      </div>
      <Button type="submit">Save rule</Button>
    </form>
  );
}
