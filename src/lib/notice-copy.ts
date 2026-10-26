export function hello(name: string) {
  return `Hello ${name.trim() || "there"},`;
}

export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://guest.neweast.cloud").replace(/\/$/, "");
}

export function intranetUrl() {
  return (process.env.INTRANET_URL || "https://intranet.neweast.cloud").replace(/\/$/, "");
}

export function visitLink(visitId: string) {
  return `${appBaseUrl()}/visits/${visitId}`;
}

export function noticeCta(type: string) {
  if (type === "APPROVAL_REQUIRED" || type === "LINE_APPROVAL") return "Open to approve";
  if (type === "ESCALATION_REQUIRED") return "Open escalation";
  if (type === "SERVICE_PREP") return "Open service tasks";
  if (type === "SECURITY_DESK") return "Open security desk";
  if (type === "GIFT_REQUEST") return "Open gift request";
  if (type === "GATE_PASS_REQUEST") return "Open gate pass";
  if (type === "DRIVER_NEEDED" || type === "GIFT_READY" || type === "GATE_PASS_READY" || type === "INTAKE_READY") {
    return "Open intake";
  }
  if (type === "DRIVER_UPDATE" || type === "GIFT_UPDATE" || type === "GATE_PASS_UPDATE") return "Open request";
  if (type === "PARKING_ASSIGNED") return "Open intranet";
  return "Open visit";
}

export function noticeUrl(type: string, visitId?: string | null) {
  if (type === "PARKING_ASSIGNED") return intranetUrl();
  if (!visitId) return "";
  if (type === "SERVICE_PREP") return `${appBaseUrl()}/services`;
  if (type === "LINE_APPROVAL" || type === "DRIVER_UPDATE" || type === "GIFT_UPDATE" || type === "GATE_PASS_UPDATE") {
    return `${appBaseUrl()}/request/${visitId}`;
  }
  if (type === "GIFT_REQUEST") return `${appBaseUrl()}/gifts`;
  if (type === "GATE_PASS_REQUEST") return `${appBaseUrl()}/passes`;
  if (type === "DRIVER_NEEDED" || type === "GIFT_READY" || type === "GATE_PASS_READY" || type === "INTAKE_READY") {
    return `${appBaseUrl()}/intake/${visitId}`;
  }
  if (type === "ESCALATION_REQUIRED") return `${appBaseUrl()}/escalations`;
  if (type === "SECURITY_DESK") return `${appBaseUrl()}/security?queue=desk`;
  return visitLink(visitId);
}

export function withNoticeLink(message: string, url?: string | null, label = "Open") {
  if (!url) return message;
  return `${message}\n\n${label}: ${url}`;
}

export function approvalRequestCopy(input: {
  approverName: string;
  visitorName: string;
  visitCode: string;
  purpose: string;
  hostName: string;
}) {
  return {
    title: "Visit approval required",
    message: [
      hello(input.approverName),
      `You have a visit approval request from ${input.visitorName}.`,
      `${input.visitCode} · Host: ${input.hostName}`,
      `Purpose: ${input.purpose}`,
    ].join("\n"),
  };
}

export function hostApprovalSentCopy(input: {
  hostName: string;
  visitorName: string;
  approverName: string;
  visitCode: string;
}) {
  return {
    title: "Approval requested",
    message: [
      hello(input.hostName),
      `${input.visitorName}'s visit ${input.visitCode} was sent to ${input.approverName} for approval.`,
    ].join("\n"),
  };
}

export function hostApprovalProgressCopy(input: {
  hostName: string;
  visitorName: string;
  visitCode: string;
  approvedBy: string;
  nextName: string;
}) {
  return {
    title: "Approval update",
    message: [
      hello(input.hostName),
      `${input.approvedBy} approved ${input.visitorName}'s visit ${input.visitCode}.`,
      `Next: ${input.nextName}.`,
    ].join("\n"),
  };
}

export function visitApprovedCopy(input: { toName: string; visitorName: string; visitCode: string }) {
  return {
    title: "Visit approved",
    message: [hello(input.toName), `${input.visitorName}'s visit ${input.visitCode} has been approved.`].join("\n"),
  };
}

export function servicePrepCopy(input: {
  ownerName: string;
  visitorName: string;
  visitCode: string;
  when: string;
  hostName: string;
  services: Array<{ label: string; notes: string }>;
}) {
  const list = input.services
    .map((item) => (item.notes ? `• ${item.label} — ${item.notes}` : `• ${item.label}`))
    .join("\n");
  return {
    title: `You have task ${input.visitCode}`,
    message: [
      hello(input.ownerName),
      `You have task ${input.visitCode}. Please prepare these services for ${input.visitorName}:`,
      list,
      `${input.when} · Host: ${input.hostName}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function hostServicesOpenedCopy(input: {
  hostName: string;
  visitorName: string;
  visitCode: string;
  labels: string;
}) {
  return {
    title: "Service teams notified",
    message: [
      hello(input.hostName),
      `The teams responsible for ${input.labels} were asked to prepare for ${input.visitorName} (${input.visitCode}).`,
    ].join("\n"),
  };
}

export function serviceUpdateCopy(input: {
  hostName: string;
  actorName: string;
  visitorName: string;
  visitCode: string;
  service: string;
  status: string;
  note?: string | null;
}) {
  return {
    title: `${input.service} update`,
    message: [
      hello(input.hostName),
      `${input.actorName} marked ${input.service} as ${input.status} for ${input.visitorName} (${input.visitCode}).`,
      input.note || "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function visitorNameOf(visitors: Array<{ visitor: { fullName: string } }>) {
  return visitors[0]?.visitor.fullName || "a guest";
}
