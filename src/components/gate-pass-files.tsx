import { GatePassButton } from "@/components/gate-pass-button";
import { Card } from "@/components/ui";

export function GatePassFiles({
  visitId,
  visitFile,
  people,
}: {
  visitId: string;
  visitFile?: string | null;
  people: { id: string; name: string; file?: string | null }[];
}) {
  const unnamed = people.filter((person) => !person.file);
  const files = [
    ...(visitFile
      ? [{ href: `/api/gate-passes/${visitId}`, label: unnamed.length ? `${unnamed.map((person) => person.name).join(", ")} · gate pass` : "Gate pass" }]
      : []),
    ...people
      .filter((person) => person.file)
      .map((person) => ({ href: `/api/gate-passes/${visitId}/${person.id}`, label: `${person.name} · gate pass` })),
  ];
  if (!files.length) return null;
  return (
    <Card className="mb-4" tone="sage">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Gate pass</div>
      <p className="mt-1 text-[13px] text-[var(--muted)]">The gate pass file is ready. Open it here.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {files.map((file) => (
          <GatePassButton key={file.href} href={file.href} label={file.label} />
        ))}
      </div>
    </Card>
  );
}
