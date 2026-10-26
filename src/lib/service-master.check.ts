import assert from "node:assert/strict";
import { codeFromLabel, groupTasksByOwner, isManagerTitle, isOperationalStaff, isPayrollActiveStaff, ownerEmailsFor } from "./service-master";

assert.equal(codeFromLabel("Flight ticket"), "FLIGHT_TICKET");
assert.equal(codeFromLabel("  Hotel booking  "), "HOTEL_BOOKING");

const owners = groupTasksByOwner([
  {
    requesterNotes: "Late flight",
    service: {
      label: "Airport pickup",
      owners: [
        { user: { id: "1", email: "a@x.co", name: "A" } },
        { user: { id: "2", email: "b@x.co", name: "B" } },
      ],
    },
  },
  {
    requesterNotes: "",
    service: {
      label: "Hotel booking",
      owners: [{ user: { id: "1", email: "a@x.co", name: "A" } }],
    },
  },
]);
assert.equal(owners.length, 2);
const a = owners.find((item) => item.id === "1");
assert.equal(a?.services.length, 2);
assert.equal(a?.services[0].notes, "Late flight");
assert.equal(isPayrollActiveStaff({ isActive: true, payrollNo: "101908", role: "EMPLOYEE" }), true);
assert.equal(isPayrollActiveStaff({ isActive: true, payrollNo: null, role: "DEPARTMENT_MANAGER" }), false);
assert.equal(isPayrollActiveStaff({ isActive: false, payrollNo: "101908", role: "EMPLOYEE" }), false);
assert.equal(isManagerTitle("Function Head"), true);
assert.equal(isManagerTitle("Manager"), true);
assert.equal(isManagerTitle("Executive"), false);
assert.equal(isManagerTitle("Support/Admin staff"), false);
assert.equal(isOperationalStaff({ isActive: true, payrollNo: "1", role: "EMPLOYEE", jobTitle: "Executive" }), true);
assert.equal(isOperationalStaff({ isActive: true, payrollNo: "1", role: "EMPLOYEE", jobTitle: "Manager" }), false);
assert.equal(isOperationalStaff({ isActive: true, payrollNo: "1", role: "HR_ADMIN", jobTitle: "Executive" }), false);
assert.ok(ownerEmailsFor("HOTEL", "stay").includes("deepak.rana@neweast.com"));
assert.ok(ownerEmailsFor("GREETING", "protocol").includes("frontdesk@neweast.com"));
assert.ok(!ownerEmailsFor("LUNCH", "meals").includes("olga@neweast.co"));
assert.ok(ownerEmailsFor("DRIVER", "transport").includes("waylslym27@gmail.com"));

console.log("service-master.check ok");
