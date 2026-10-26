export function displayImageSrc(imagePath: string) {
  if (!imagePath || imagePath.startsWith("blob:") || imagePath.startsWith("data:")) return imagePath;
  const file = imagePath.split("/").pop() || "";
  const stem = file.replace(/\.(jpe?g|png|webp|svg)$/i, "");
  return stem ? `/api/display/media/${stem}` : imagePath;
}

export function friendlyScreenName(name: string) {
  let label = name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const floor = /\bFF\b/i.test(label) ? "1st floor" : /\bTF\b/i.test(label) ? "3rd floor" : "";
  label = label
    .replace(/\bMB\b/gi, "")
    .replace(/\bOPB\b/gi, "")
    .replace(/\bOPS\b/gi, "")
    .replace(/\bFF\b/gi, "")
    .replace(/\bTF\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/auditorium/i.test(label)) label = "Auditorium";
  return floor ? `${label} · ${floor}` : label;
}

export const HQ_DISPLAY_SLUG = "neweast-hq";

export function displaySlug(name: string) {
  const slug = friendlyScreenName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "screen";
}

export function isHqDisplaySlug(value: string) {
  const key = value.trim().toLowerCase().replace(/_/g, "-");
  return key === HQ_DISPLAY_SLUG || key === "neweasthq" || key === "neweast-hq";
}

export function screenDisplayHref(
  screen: { name: string; token: string },
  screens: { name: string; token: string }[],
) {
  const base = displaySlug(screen.name);
  const same = screens.filter((item) => displaySlug(item.name) === base);
  const slug = same.length > 1 ? `${base}-${screen.token.slice(0, 6)}` : base;
  return `/display/${slug}`;
}
