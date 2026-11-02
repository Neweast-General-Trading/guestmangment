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
import { canOpenAppPath, navFor } from "./permissions";

assert.equal(isFullAccess("sakour@neweast.co"), true);
assert.equal(isFullAccess("guru@neweast.co"), true);
assert.equal(isFullAccess("guru@neweast.com"), true);
assert.equal(isFullAccess("olga@neweast.co"), false);
assert.equal(isFullAccess("mkhlalati@neweast.com"), false);
assert.equal(canManageAccess("sakour@neweast.co"), true);
assert.equal(canManageAccess("guru@neweast.co"), true);
assert.ok(navFor("EMPLOYEE", "sakour@neweast.co").some((item) => item.href === "/access"));
assert.ok(navFor("EMPLOYEE", "guru@neweast.co").some((item) => item.href === "/access"));
assert.ok(navFor("EMPLOYEE", "maria@neweast.com").some((item) => item.href === "/rooms"));
assert.equal(navFor("EMPLOYEE", "maria@neweast.com").some((item) => item.href === "/intake"), false);
assert.ok(navFor("EMPLOYEE", "hannah@neweast.co").some((item) => item.href === "/request"));
assert.equal(navFor("EMPLOYEE", "carina@neweast.co").some((item) => item.href === "/reports"), false);
assert.equal(canOpenAppPath("EMPLOYEE", "ops@neweast.co", null, "/directory"), false);
assert.equal(canOpenAppPath("EMPLOYEE", "ops@neweast.co", null, "/visits"), false);
assert.equal(canOpenAppPath("EMPLOYEE", "ops@neweast.co", null, "/reports"), false);
assert.equal(canOpenAppPath("EMPLOYEE", "ops@neweast.co", null, "/intake"), false);
assert.equal(canOpenAppPath("EMPLOYEE", "ops@neweast.co", null, "/request"), true);
assert.equal(canOpenAppPath("EMPLOYEE", "ops@neweast.co", null, "/request/abc"), true);
assert.equal(canOpenAppPath("EMPLOYEE", "ops@neweast.co", null, "/notifications"), true);
assert.equal(canOpenAppPath("HR_ADMIN", "frontdesk@neweast.com", null, "/rooms"), true);
assert.equal(canOpenAppPath("SECURITY_GUARD", "security@neweast.co", null, "/reports"), false);
assert.ok(navFor("EMPLOYEE", "sakour@neweast.co").some((item) => item.href === "/assign-parking"));
assert.ok(navFor("EMPLOYEE", "sakour@neweast.co").some((item) => item.href === "/security"));
assert.ok(navFor("EMPLOYEE", "sakour@neweast.co").some((item) => item.href === "/intake"));
assert.ok(navFor("EMPLOYEE", "sakour@neweast.co").some((item) => item.href === "/tracking"));
assert.equal(navFor("EMPLOYEE", "guru@neweast.co").some((item) => item.href === "/tracking"), false);
assert.ok(navFor("EMPLOYEE", "guru@neweast.com").some((item) => item.href === "/assign-parking"));
assert.ok(navFor("EMPLOYEE", "guru@neweast.com").some((item) => item.href === "/security"));
assert.ok(navFor("EMPLOYEE", "guru@neweast.com").some((item) => item.href === "/intake"));
assert.equal(navFor("EMPLOYEE", "mkhlalati@neweast.com").some((item) => item.href === "/intake"), false);
assert.ok(navFor("EMPLOYEE", "jesman@neweast.co").some((item) => item.href === "/gifts"));
assert.ok(navFor("EMPLOYEE", "jesman@neweast.co").some((item) => item.href === "/request"));
assert.equal(navFor("EMPLOYEE", "jesman@neweast.co").some((item) => item.href === "/intake"), false);
assert.ok(navFor("HR_ADMIN", "mais.alhamwi@neweast.com").some((item) => item.href === "/intake"));
assert.ok(navFor("SYSTEM_ADMIN", "olga@neweast.co").some((item) => item.href === "/intake"));
assert.equal(navFor("SYSTEM_ADMIN", "sachini@neweast.com").some((item) => item.href === "/access"), false);
assert.ok(navFor("EMPLOYEE", "sachini@neweast.com").some((item) => item.href === "/rooms"));
assert.ok(navFor("EMPLOYEE", "sachini@neweast.com").some((item) => item.href === "/assign-parking"));
assert.ok(navFor("EMPLOYEE", "sachini@neweast.com").some((item) => item.href === "/drivers"));
assert.ok(navFor("EMPLOYEE", "sachinialwis1993@gmail.com").some((item) => item.href === "/rooms"));
assert.equal(navFor("EMPLOYEE", "sachini@neweast.com").some((item) => item.href === "/intake"), false);
assert.ok(navFor("HR_ADMIN", "sachini@neweast.com").some((item) => item.href === "/intake"));
assert.ok(navFor("HR_ADMIN", "sachini@neweast.com").some((item) => item.href === "/passes"));
assert.ok(navFor("HR_ADMIN", "sachini@neweast.com").some((item) => item.href === "/drivers"));
assert.ok(navFor("HR_ADMIN", "sachini@neweast.com").some((item) => item.href === "/assign-parking"));
assert.equal(navFor("HR_ADMIN", "sachini@neweast.com").some((item) => item.href === "/access"), false);
assert.equal(canManageAccess("SAKOUR@neweast.co"), true);
assert.equal(canManageAccess("sakour@neweast.com"), false);
assert.equal(canManageAccess("olga@neweast.co"), false);

assert.equal(inferAccessGroup({ departmentCode: "BUSINESS_SYSTEMS" }), "EMPLOYEE");
assert.equal(inferAccessGroup({ departmentCode: "IT" }), "EMPLOYEE");
assert.equal(inferAccessGroup({ departmentCode: "HR_ADMINISTRATION" }), "EMPLOYEE");
assert.equal(inferAccessGroup({ departmentCode: "ADMINISTRATION" }), "EMPLOYEE");
assert.equal(inferAccessGroup({ departmentCode: "MANAGEMENT" }), "EMPLOYEE");
assert.equal(inferAccessGroup({ departmentCode: "EXEC" }), "EMPLOYEE");
assert.equal(inferAccessGroup({ role: "MANAGEMENT", departmentCode: "CUSTOMER_SERVICE" }), "EMPLOYEE");
assert.equal(inferAccessGroup({ role: "HR_ADMIN", departmentCode: "MARKETING" }), "EMPLOYEE");
assert.equal(inferAccessGroup({ departmentCode: "OPERATIONS" }), "EMPLOYEE");
assert.equal(inferAccessGroup({ departmentCode: "HR_ADMINISTRATION_KSA" }), "EMPLOYEE");

assert.equal(isAccessGroup("ADMINISTRATION"), true);
assert.equal(isAccessGroup("HR"), true);
assert.equal(isAccessGroup("IT"), true);
assert.equal(isAccessGroup("EMPLOYEE"), true);
assert.equal(isAccessGroup("BUSINESS_IT"), false);
assert.equal(accessGroupLabel("ADMINISTRATION"), "Administration");
assert.equal(accessGroupLabel(null), "Employee");

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
assert.equal(parseAccessGroup("HR"), "HR");
assert.throws(() => parseAccessGroup("HR_ADMINISTRATION"));
assert.throws(() => parseAccessGroup("OPERATIONS"));
assert.equal(parseAssignableRole("DEPARTMENT_MANAGER"), "DEPARTMENT_MANAGER");
assert.throws(() => parseAssignableRole("SECURITY_GUARD"));

assert.match(roleNature("DEPARTMENT_MANAGER"), /submit/i);
assert.match(roleNature("EMPLOYEE"), /submit/i);

assert.equal(parseAccessPage("3"), 3);
assert.equal(parseAccessPage("0"), 1);
assert.equal(parseAccessPage("no"), 1);
assert.equal(parseAccessPageSize("50"), 50);
assert.equal(parseAccessPageSize("15"), ACCESS_PAGE_SIZE);
assert.equal(accessHref({}), "/access");
assert.equal(accessHref({ group: "IT", page: 1 }), "/access?group=IT");
assert.equal(accessHref({ group: "EMPLOYEE", q: "sakour", page: 3, pageSize: 50 }), "/access?group=EMPLOYEE&q=sakour&page=3&pageSize=50");
assert.deepEqual(accessListWhere({}), { isActive: true, accessGroup: "ADMINISTRATION" });
assert.deepEqual(accessListWhere({ group: "HR" }), { isActive: true, accessGroup: "HR" });
assert.equal(JSON.stringify(accessListWhere({ q: "sakour" })).includes("sakour"), true);

console.log("access.check: ok");
