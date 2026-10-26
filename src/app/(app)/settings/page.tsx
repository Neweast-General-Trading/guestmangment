import { redirect } from "next/navigation";
import { saveSettingsAction, syncPayrollAction, toggleRuleAction } from "@/app/actions";
import { ApprovalRuleForm } from "@/components/approval-rule-form";
import { RuleList } from "@/components/paged-tables";
import { Button, Card, PageHeader, TextInput, Textarea } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageConfig, canManageServiceMaster } from "@/lib/permissions";
import { ensureDefaultApprovalRules } from "@/lib/approvals";
import { FORM_VISIT_TYPES } from "@/lib/constants";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!session) return null;
  if (!canManageConfig(session.role)) redirect("/dashboard");

  await ensureDefaultApprovalRules();

  const [settings, rules, departments] = await Promise.all([
    prisma.systemSetting.findMany(),
    prisma.approvalRule.findMany({ orderBy: { visitType: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);
  const map = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  const visible = rules.filter((rule) => FORM_VISIT_TYPES.includes(rule.visitType as (typeof FORM_VISIT_TYPES)[number]));

  return (
    <div>
      <PageHeader
        title="System configuration"
        description="Approval rules, security policy, and payroll hosts."
        actions={
          <>
            {canManageServiceMaster(session.role) ? (
              <Button href="/master/services" variant="secondary">
                Service master
              </Button>
            ) : null}
            <Button href="/audit" variant="secondary">
              Audit logs
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium">Security policy</h2>
          <form action={saveSettingsAction} className="space-y-3">
            <label className="block text-[12px] text-[var(--muted)]">Appointment window (minutes)</label>
            <TextInput name="appointment_window_minutes" defaultValue={map.appointment_window_minutes} />
            <label className="block text-[12px] text-[var(--muted)]">Data retention (days)</label>
            <TextInput name="data_retention_days" defaultValue={map.data_retention_days} />
            <label className="block text-[12px] text-[var(--muted)]">Visitor instructions</label>
            <Textarea name="invite_instructions" defaultValue={map.invite_instructions} />
            <label className="block text-[12px] text-[var(--muted)]">Location instructions</label>
            <Textarea name="location_instructions" defaultValue={map.location_instructions} />
            <label className="block text-[12px] text-[var(--muted)]">Parking instructions</label>
            <Textarea name="parking_instructions" defaultValue={map.parking_instructions} />
            <TextInput name="badge_prefix" defaultValue={map.badge_prefix} />
            <Button type="submit">Save policy</Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Approval rule</h2>
          <ApprovalRuleForm departments={departments} />
          <div className="mt-4">
            <RuleList rules={visible} onToggle={toggleRuleAction} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Teams notices</h2>
          <p className="mb-3 text-[13px] text-[var(--muted)]">
            Paste a Teams incoming webhook or Workflow URL. While testing, every notice also emails the test inbox.
          </p>
          <form action={saveSettingsAction} className="space-y-3">
            <label className="block text-[12px] text-[var(--muted)]">Incoming webhook</label>
            <TextInput name="teams_webhook" defaultValue={map.teams_webhook} placeholder="https://..." />
            <Button type="submit">Save Teams webhook</Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Employee names</h2>
          <p className="mb-3 text-[13px] text-[var(--muted)]">
            Host names load from payroll. Last sync: {map.payroll_synced_at ? new Date(map.payroll_synced_at).toLocaleString() : "never"}
          </p>
          <form action={syncPayrollAction}>
            <Button type="submit">Refresh employees</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
