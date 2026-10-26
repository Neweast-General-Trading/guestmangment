export function matches(text: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

export function paginate<T>(items: T[], page: number, size: number) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size) || 1);
  const current = Math.min(Math.max(1, page), pages);
  return {
    page: current,
    pages,
    total,
    rows: items.slice((current - 1) * size, current * size),
  };
}

export const PAGE_SIZE = 10;

export function pageNumbers(page: number, pages: number): Array<number | "…"> {
  const last = Math.max(1, pages);
  const current = Math.min(Math.max(1, page), last);
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1);
  const marks = new Set([1, last, current - 1, current, current + 1].filter((n) => n >= 1 && n <= last));
  const sorted = [...marks].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const n = sorted[index];
    if (index > 0 && n - sorted[index - 1] > 1) out.push("…");
    out.push(n);
  }
  return out;
}
