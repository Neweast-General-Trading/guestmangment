import assert from "node:assert/strict";
import {
  ACCESS_PAGE_SIZE,
  accessGroupLabel,
  accessHref,
  accessListWhere,
  canManageAccess,
  canUseRequestDesk,
  inferAccessGroup,
  isAccessGroup,
  isFullAccess,
  parseAccessGroup,
  parseAccessPage,
  parseAccessPageSize,
  parseAssignableRole,
  roleNature,
} from "./access";
import { navFor } from "./permissions";

assert.equal(isFullAccess("sakour@neweast.co"), true);
assert.equal(isFullAccess("guru@neweast.co"), true);
assert.equal(isFullAccess("guru@neweast.com"), true);
assert.equal(isFullAccess("olga@neweast.co"), false);
assert.equal(canManageAccess("sakour@neweast.co"), true);
assert.equal(canManageAccess("guru@neweast.co"), true);
assert.ok(navFor("EMPLOYEE", "sakour@neweast.co").some((item) => item.href === "/assign-parking"));
assert.ok(navFor("EMPLOYEE", "sakour@neweast.co").some((item) => item.href === "/security"));
assert.ok(navFor("EMPLOYEE", "sakour@neweast.co").some((item) => item.href === "/intake"));
assert.ok(navFor("EMPLOYEE", "sakour@neweast.co").some((item) => item.href === "/tracking"));
assert.equal(navFor("EMPLOYEE", "guru@neweast.co").some((item) => item.href === "/tracking"), false);
assert.ok(navFor("EMPLOYEE", "guru@neweast.com").some((item) => item.href === "/assign-parking"));
assert.ok(navFor("EMPLOYEE", "guru@neweast.com").some((item) => item.href === "/security"));
assert.ok(navFor("EMPLOYEE", "guru@neweast.com").some((item) => item.href === "/intake"));
assert.equal(canManageAccess("SAKOUR@neweast.co"), true);
assert.equal(canManageAccess("sakour@neweast.com"), false);
assert.equal(canManageAccess("olga@neweast.co"), false);

assert.equal(inferAccessGroup({ departmentCode: "BUSINESS_SYSTEMS" }), "BUSINESS_IT");
assert.equal(inferAccessGroup({ departmentCode: "IT" }), "BUSINESS_IT");
assert.equal(inferAccessGroup({ departmentCode: "HR_ADMINISTRATION" }), "HR_ADMINISTRATION");
assert.equal(inferAccessGroup({ departmentCode: "ADMINISTRATION" }), "HR_ADMINISTRATION");
assert.equal(inferAccessGroup({ departmentCode: "MANAGEMENT" }), "MANAGEMENT");
assert.equal(inferAccessGroup({ departmentCode: "EXEC" }), "MANAGEMENT");
assert.equal(inferAccessGroup({ role: "MANAGEMENT", departmentCode: "CUSTOMER_SERVICE" }), "MANAGEMENT");
assert.equal(inferAccessGroup({ role: "HR_ADMIN", departmentCode: "MARKETING" }), "HR_ADMINISTRATION");
assert.equal(inferAccessGroup({ departmentCode: "OPERATIONS" }), null);
assert.equal(inferAccessGroup({ departmentCode: "HR_ADMINISTRATION_KSA" }), null);

assert.equal(isAccessGroup("BUSINESS_IT"), true);
assert.equal(isAccessGroup("OPERATIONS"), false);
assert.equal(accessGroupLabel("BUSINESS_IT"), "Business & IT");
assert.equal(accessGroupLabel(null), "No access");

assert.equal(
  canUseRequestDesk({ role: "EMPLOYEE", email: "guru@neweast.co", accessGroup: "BUSINESS_IT" }),
  true,
);
assert.equal(canUseRequestDesk({ role: "EMPLOYEE", email: "ops@neweast.co", accessGroup: null }), true);
assert.equal(canUseRequestDesk({ role: "EMPLOYEE", email: "rizwan@neweast.co", accessGroup: null }), true);
assert.equal(canUseRequestDesk({ role: "MANAGEMENT", email: "ahmed@neweast.co", accessGroup: "MANAGEMENT" }), true);
assert.equal(canUseRequestDesk({ role: "SYSTEM_ADMIN", email: "adminsatror@neweast.co", accessGroup: null }), true);
assert.equal(canUseRequestDesk({ role: "HR_ADMIN", email: "olga@neweast.co", accessGroup: null }), true);
assert.equal(canUseRequestDesk({ role: "EMPLOYEE", email: "sakour@neweast.co", accessGroup: null }), true);
assert.equal(canUseRequestDesk({ role: "SECURITY_GUARD", email: "gate@neweast.co", accessGroup: "BUSINESS_IT" }), false);

assert.equal(parseAccessGroup(""), null);
assert.equal(parseAccessGroup("HR_ADMINISTRATION"), "HR_ADMINISTRATION");
assert.throws(() => parseAccessGroup("OPERATIONS"));
assert.equal(parseAssignableRole("DEPARTMENT_MANAGER"), "DEPARTMENT_MANAGER");
assert.throws(() => parseAssignableRole("SECURITY_GUARD"));

assert.match(roleNature("DEPARTMENT_MANAGER"), /approve/i);
assert.match(roleNature("EMPLOYEE"), /submit/i);

assert.equal(parseAccessPage("3"), 3);
assert.equal(parseAccessPage("0"), 1);
assert.equal(parseAccessPage("no"), 1);
assert.equal(parseAccessPageSize("50"), 50);
assert.equal(parseAccessPageSize("15"), ACCESS_PAGE_SIZE);
assert.equal(accessHref({}), "/access");
assert.equal(accessHref({ group: "BUSINESS_IT", page: 1 }), "/access?group=BUSINESS_IT");
assert.equal(accessHref({ group: "none", q: "sakour", page: 3, pageSize: 50 }), "/access?group=none&q=sakour&page=3&pageSize=50");
assert.deepEqual(accessListWhere({}), {
  isActive: true,
  accessGroup: { in: ["BUSINESS_IT", "HR_ADMINISTRATION", "MANAGEMENT"] },
});
assert.deepEqual(accessListWhere({ group: "MANAGEMENT" }), { isActive: true, accessGroup: "MANAGEMENT" });
assert.equal(JSON.stringify(accessListWhere({ q: "sakour" })).includes("sakour"), true);

console.log("access.check: ok");
