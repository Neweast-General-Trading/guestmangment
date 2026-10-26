import { prisma } from "./prisma";
import { buildTeamsApiUrl } from "./teams-url";

export function isGuruApprover(user?: { email?: string | null; name?: string | null }) {
  const email = (user?.email || "").toLowerCase();
  const name = (user?.name || "").toLowerCase();
  return email === "guru@neweast.co" || name === "guru gopalan";
}

export function isSamirApprover(user?: { email?: string | null; name?: string | null }) {
  const email = (user?.email || "").toLowerCase();
  const name = (user?.name || "").toLowerCase();
  return email === "samir.ibrahim@neweast.co" || name === "samir ibrahim";
}

export function teamsGoesToAssignee(_type?: string, user?: { email?: string | null; name?: string | null }) {
  return Boolean((user?.email || "").trim());
}

export function teamsPayloads(input: { title: string; message: string; onBehalfOf?: string }) {
  const who = input.onBehalfOf?.trim();
  const text = [input.title, who ? `Assigned to: ${who}` : "", input.message].filter(Boolean).join("\n\n");
  return [
    {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      themeColor: "B51E21",
      summary: input.title,
      title: input.title,
      text: input.message.replaceAll("\n", "<br>"),
      sections: who ? [{ facts: [{ name: "Assigned to", value: who }] }] : [],
    },
    { text },
  ];
}

async function resolveTarget(input: { mailId?: string; name?: string; type?: string }) {
  return {
    mailId: input.mailId?.trim() || "",
    name: input.name?.trim() || "Guest Management",
  };
}

export async function resolveTeamsWebhook() {
  const fromEnv = process.env.TEAMS_WEBHOOK?.trim();
  if (fromEnv) return fromEnv;
  const row = await prisma.systemSetting.findUnique({ where: { key: "teams_webhook" } });
  return row?.value?.trim() || "";
}

export async function sendTeamsNotice(input: {
  title: string;
  message: string;
  onBehalfOf?: string;
  mailId?: string;
  name?: string;
  type?: string;
}) {
  const target = await resolveTarget(input);
  if (!target.mailId) return { ok: false as const, error: "No Teams recipient." };
  const desc = [input.title, input.message].filter(Boolean).join("\n\n");
  const teamsApi = process.env.TEAMS_API?.trim();

  if (teamsApi && target.mailId && /^https?:\/\//i.test(teamsApi)) {
    try {
      const res = await fetch(buildTeamsApiUrl(teamsApi, { name: target.name, mailId: target.mailId, desc }), {
        method: "POST",
      });
      if (res.ok) return { ok: true as const };
    } catch {
      // fall through to incoming webhook
    }
  }

  const webhook = await resolveTeamsWebhook();
  if (!webhook) return { ok: false as const, error: "Teams is not configured." };

  for (const body of teamsPayloads(input)) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true as const };
    } catch {
      // try the next payload shape
    }
  }
  return { ok: false as const, error: "Teams delivery failed." };
}
