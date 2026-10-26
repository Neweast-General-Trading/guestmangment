const PALETTE = ["#d48a8c", "#8fb3d1", "#d2c089", "#c9a06a", "#b4a6d0", "#97c09a", "#c9b08a", "#9cb8c4"];

export type Slice = { label: string; value: number; color?: string };

function pairs(data: Record<string, number>, mapLabel?: (key: string) => string): Slice[] {
  return Object.entries(data)
    .map(([label, value]) => ({ label: mapLabel ? mapLabel(label) : label, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function colored(items: Slice[]): Slice[] {
  return items.map((item, i) => ({ ...item, color: item.color ?? PALETTE[i % PALETTE.length] }));
}

export function DonutChart({
  items,
  size = 168,
}: {
  items: Slice[];
  size?: number;
}) {
  const rows = colored(items.filter((item) => item.value > 0));
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 140 140" className="shrink-0">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#edf2f1" strokeWidth="16" />
        {total === 0 ? null : (
          <g transform="rotate(-90 70 70)">
            {rows.map((item) => {
              const len = (item.value / total) * c;
              const node = (
                <circle
                  key={item.label}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="16"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return node;
            })}
          </g>
        )}
        <text x="70" y="66" textAnchor="middle" fontSize="18" fontWeight="500" fill="#14201f">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#5b6766">
          total
        </text>
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {rows.length === 0 ? (
          <p className="text-[12px] text-[var(--muted)]">No data yet.</p>
        ) : (
          rows.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-[12px]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="tabular-nums text-[var(--muted)]">{item.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ColumnChart({
  items,
  height = 140,
}: {
  items: Slice[];
  height?: number;
}) {
  const rows = colored(items);
  const max = Math.max(...rows.map((item) => item.value), 1);
  return (
    <div className="flex h-full items-end gap-1.5" style={{ height }}>
      {rows.length === 0 ? (
        <p className="self-center text-[12px] text-[var(--muted)]">No data yet.</p>
      ) : (
        rows.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="text-[10px] tabular-nums text-[var(--muted)]">{item.value || ""}</div>
            <div className="flex w-full items-end justify-center" style={{ height: height - 36 }}>
              <div
                className="w-full max-w-7 rounded-t-md"
                style={{
                  height: `${Math.max(6, (item.value / max) * 100)}%`,
                  background: `linear-gradient(180deg, ${item.color}cc, ${item.color}88)`,
                }}
              />
            </div>
            <div className="w-full truncate text-center text-[10px] text-[var(--muted)]">{item.label}</div>
          </div>
        ))
      )}
    </div>
  );
}

export function AreaChart({ items }: { items: Slice[] }) {
  const rows = items.slice(-14);
  const w = 520;
  const h = 140;
  const pad = 8;
  const max = Math.max(...rows.map((item) => item.value), 1);
  const step = rows.length > 1 ? (w - pad * 2) / (rows.length - 1) : 0;
  const pts = rows.map((item, i) => {
    const x = pad + i * step;
    const y = h - pad - (item.value / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const line = pts.join(" ");
  const area = rows.length ? `M${pad},${h - pad} L${line.replace(/ /g, " L")} L${pad + (rows.length - 1) * step},${h - pad} Z` : "";

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7eb8b3" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7eb8b3" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {rows.length ? (
          <>
            <path d={area} fill="url(#areaFill)" />
            <polyline points={line} fill="none" stroke="#6aa8a2" strokeWidth="2.2" strokeLinejoin="round" />
          </>
        ) : null}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
        <span>{rows[0]?.label ?? ""}</span>
        <span>{rows[rows.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}

export function HBars({
  data,
  mapLabel,
}: {
  data: Record<string, number>;
  mapLabel?: (key: string) => string;
}) {
  const rows = colored(pairs(data, mapLabel).slice(0, 8));
  const max = Math.max(...rows.map((item) => item.value), 1);
  return (
    <div className="space-y-2.5">
      {rows.length === 0 ? <p className="text-[12px] text-[var(--muted)]">No data yet.</p> : null}
      {rows.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-[12px]">
            <span className="truncate pr-3">{item.label}</span>
            <span className="tabular-nums text-[var(--muted)]">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/70">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, background: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function series(data: Record<string, number>, mapLabel?: (key: string) => string) {
  return pairs(data, mapLabel);
}
