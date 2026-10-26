import assert from "node:assert/strict";
import {
  approvalRequestCopy,
  hostApprovalSentCopy,
  hostServicesOpenedCopy,
  intranetUrl,
  noticeCta,
  noticeUrl,
  servicePrepCopy,
  serviceUpdateCopy,
  visitorNameOf,
  withNoticeLink,
} from "./notice-copy";
import { publicOrigin, publicUrl, safeNext } from "./safe-next";
import { buildTeamsApiUrl } from "./teams-url";
const approval = approvalRequestCopy({
  approverName: "Olga Kameniuk",
  visitorName: "Ahmed Ali",
  visitCode: "GV-2026-000012",
  purpose: "Contract review",
  hostName: "Jad Sakour",
});
assert.match(approval.message, /Hello Olga Kameniuk/);
assert.match(approval.message, /visit approval request from Ahmed Ali/);
assert.match(approval.message, /GV-2026-000012/);

const host = hostApprovalSentCopy({
  hostName: "Jad Sakour",
  visitorName: "Ahmed Ali",
  approverName: "Olga Kameniuk",
  visitCode: "GV-2026-000012",
});
assert.match(host.message, /sent to Olga Kameniuk/);

const prep = servicePrepCopy({
  ownerName: "Olga Kameniuk",
  visitorName: "Ahmed Ali",
  visitCode: "GV-2026-000012",
  when: "22 Sep 2026 · 10:00",
  hostName: "Jad Sakour",
  services: [{ label: "Hotel", notes: "2 nights" }],
});
assert.match(prep.message, /Hello Olga Kameniuk/);
assert.match(prep.message, /You have task GV-2026-000012/);
assert.match(prep.message, /Hotel — 2 nights/);
assert.equal(prep.message.includes("was approved"), false);

const opened = hostServicesOpenedCopy({
  hostName: "Jad Sakour",
  visitorName: "Ahmed Ali",
  visitCode: "GV-2026-000012",
  labels: "Hotel, Pickup",
});
assert.match(opened.message, /Hotel, Pickup/);

const update = serviceUpdateCopy({
  hostName: "Jad Sakour",
  actorName: "Olga Kameniuk",
  visitorName: "Ahmed Ali",
  visitCode: "GV-2026-000012",
  service: "Hotel",
  status: "Done",
  note: "Booked",
});
assert.match(update.message, /marked Hotel as Done/);
assert.equal(visitorNameOf([{ visitor: { fullName: "Ahmed Ali" } }]), "Ahmed Ali");

const built = new URL(
  buildTeamsApiUrl("https://example.test/invoke?api-version=2016-06-01", {
    name: "Jad Sakour",
    mailId: "sakour@neweast.co",
    desc: approval.message,
  }),
);
assert.equal(built.searchParams.get("Name"), "Jad Sakour");
assert.equal(built.searchParams.get("MailID"), "sakour@neweast.co");
assert.match(built.searchParams.get("Desc") || "", /Ahmed Ali/);

assert.equal(noticeCta("APPROVAL_REQUIRED"), "Open to approve");
assert.equal(noticeCta("GIFT_REQUEST"), "Open gift request");
assert.match(noticeUrl("GIFT_REQUEST", "visit-1"), /\/gifts$/);
assert.equal(noticeCta("GATE_PASS_REQUEST"), "Open gate pass");
assert.match(noticeUrl("GATE_PASS_REQUEST", "visit-1"), /\/passes$/);
assert.equal(noticeCta("DRIVER_UPDATE"), "Open request");
assert.match(noticeUrl("DRIVER_UPDATE", "visit-1"), /\/request\/visit-1$/);
assert.match(noticeUrl("DRIVER_NEEDED", "visit-1"), /\/intake\/visit-1$/);
assert.equal(noticeCta("INTAKE_READY"), "Open intake");
assert.match(noticeUrl("INTAKE_READY", "visit-1"), /\/intake\/visit-1$/);
assert.match(noticeUrl("APPROVAL_REQUIRED", "visit-1"), /\/visits\/visit-1$/);
assert.equal(noticeUrl("PARKING_ASSIGNED"), intranetUrl());
assert.match(noticeUrl("PARKING_ASSIGNED"), /intranet\.neweast\.cloud$/);
assert.equal(noticeCta("PARKING_ASSIGNED"), "Open intranet");
assert.match(withNoticeLink("Hello", "https://guest.neweast.cloud/visits/x", "Open to approve"), /Open to approve: https:\/\//);
assert.equal(safeNext("/visits/abc"), "/visits/abc");
assert.equal(safeNext("/sso"), "/dashboard");
assert.equal(publicOrigin(new Headers({ host: "0.0.0.0:3088" })), "https://guest.neweast.cloud");
assert.equal(publicUrl("/request", new Headers({ host: "guest.neweast.cloud", "x-forwarded-proto": "https" })).href, "https://guest.neweast.cloud/request");
assert.equal(safeNext("https://evil.test"), "/dashboard");
assert.equal(safeNext("//evil.test"), "/dashboard");
console.log("notice-copy.check: ok");
