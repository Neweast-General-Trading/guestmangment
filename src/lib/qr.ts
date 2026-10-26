export function parseQrPayload(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const invite = parts.indexOf("invite");
    if (invite >= 0 && parts[invite + 1]) return decodeURIComponent(parts[invite + 1]);
    const scan = parts.indexOf("scan");
    if (scan >= 0 && parts[scan + 1]) return decodeURIComponent(parts[scan + 1]);
  } catch {
    // hardware scanners sometimes append a trailing slash or spaces only
  }
  return value.replace(/\/$/, "");
}
