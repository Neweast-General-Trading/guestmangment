const LOCAL_HOST = /^(0\.0\.0\.0|127\.0\.0\.1|\[::\]|\[::1\])(?::\d+)?$/i;

export function publicOrigin(headers?: Headers | null) {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "https://guest.neweast.cloud").replace(/\/$/, "");
  if (!headers) return configured;
  const host = (headers.get("x-forwarded-host") || headers.get("host") || "").split(",")[0].trim();
  if (!host || LOCAL_HOST.test(host)) return configured;
  const proto =
    (headers.get("x-forwarded-proto") || "").split(",")[0].trim() ||
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function publicUrl(path: string, headers?: Headers | null) {
  const href = path.startsWith("/") ? path : `/${path}`;
  return new URL(href, `${publicOrigin(headers)}/`);
}

export function safeNext(value?: string | null) {
  const next = (value || "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return "/dashboard";
  if (next.startsWith("/login") || next.startsWith("/sso")) return "/dashboard";
  return next;
}
