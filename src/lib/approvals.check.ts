import assert from "node:assert/strict";
import { approvalDesk, approvalState, DEFAULT_RULES, stepsFromPresetCodes } from "./approvals";
import { canDecideApproval } from "./permissions";

function check() {
  assert.equal(canDecideApproval("HR_ADMIN", "DEPARTMENT_MANAGER"), true);
  assert.equal(canDecideApproval("SECURITY_SUPERVISOR", "HR_ADMIN"), true);
  assert.equal(
    canDecideApproval("SECURITY_GUARD", "HR_ADMIN", { actorId: "g1", createdById: "other" }),
    true,
  );
  assert.equal(
    canDecideApproval("SECURITY_GUARD", "HR_ADMIN", { actorId: "g1", createdById: "g1" }),
    false,
  );
  assert.equal(
    canDecideApproval("EMPLOYEE", "EMPLOYEE", { actorId: "h1", hostId: "h1" }),
    true,
  );

  const visit = {
    status: "PENDING_APPROVAL",
    department: { name: "Operations" },
    approvals: [
      { requiredRole: "DEPARTMENT_MANAGER", status: "APPROVED", stepName: "Department manager", assignee: { name: "Hana", department: { name: "Operations" } } },
      { requiredRole: "HR_ADMIN", status: "PENDING", stepName: "Administration approval", assignee: null },
    ],
  };
  assert.equal(approvalDesk(visit.approvals[1], visit), "Administration / HR");
  assert.equal(approvalState(visit).desk, "Administration / HR");
  assert.equal(approvalState(visit).status, "PENDING");
  assert.equal(DEFAULT_RULES.length, 2);
  assert.equal(DEFAULT_RULES[0].visitType, "CUSTOMER");
  assert.equal(DEFAULT_RULES[1].steps[0]?.preset, "MAIS");
  assert.deepEqual(
    stepsFromPresetCodes(["HOST_MANAGER", "SAMIR"]).map((step) => step.preset),
    ["HOST_MANAGER", "SAMIR"],
  );
  console.log("approvals.check: ok");
}

check();
