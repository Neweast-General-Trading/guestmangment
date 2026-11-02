import { guestDocHref, parseGuestDocs, type GuestDocType } from "@/lib/guest-doc-types";

function docLabel(type: GuestDocType) {
  if (type === "PASSPORT") return "Passport";
  if (type === "VISA") return "Visa";
  return "ID";
}

const GENERIC_NAME = new Set(["san", "mr", "mrs", "ms", "dr", "guest", "passport", "visa", "pdf", "jpg", "jpeg", "png", "webp"]);

function nameTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 4 && !GENERIC_NAME.has(token));
}

export type GuestFileLink = { key: string; label: string; name: string; href: string };

export function filesForGuests(
  visitId: string,
  people: { id: string; name: string; attachmentsJson?: string | null }[],
  attachmentsJson?: string | null,
) {
  const own = new Map<string, GuestFileLink[]>();
  const seen = new Set<string>();
  for (const person of people) {
    const files = parseGuestDocs(person.attachmentsJson).map((doc) => {
      seen.add(doc.stored);
      return {
        key: `${person.id}-${doc.stored}`,
        label: docLabel(doc.type),
        name: doc.name,
        href: guestDocHref(visitId, doc.type, person.id, doc.stored),
      };
    });
    own.set(person.id, files);
  }
  const loose: GuestFileLink[] = [];
  for (const doc of parseGuestDocs(attachmentsJson)) {
    if (seen.has(doc.stored)) continue;
    const file = {
      key: `visit-${doc.stored}`,
      label: docLabel(doc.type),
      name: doc.name,
      href: guestDocHref(visitId, doc.type, undefined, doc.stored),
    };
    const hay = doc.name.toLowerCase();
    const hits = people.filter((person) => nameTokens(person.name).some((token) => hay.includes(token)));
    if (hits.length === 1) own.get(hits[0].id)?.push(file);
    else loose.push(file);
    seen.add(doc.stored);
  }
  return { own, loose };
}

export function GuestAttachmentList({
  visitId,
  attachmentsJson,
  people,
  heading,
  showEmpty = false,
  className = "",
}: {
  visitId: string;
  attachmentsJson?: string | null;
  people: { id: string; name: string; attachmentsJson?: string | null }[];
  heading?: string;
  showEmpty?: boolean;
  className?: string;
}) {
  const files = people.flatMap((person) =>
    parseGuestDocs(person.attachmentsJson).map((doc) => ({
      key: `${person.id}-${doc.type}`,
      guest: person.name,
      label: docLabel(doc.type),
      name: doc.name,
      href: guestDocHref(visitId, doc.type, person.id, doc.stored),
    })),
  );
  const seen = new Set(files.map((file) => file.name));
  for (const doc of parseGuestDocs(attachmentsJson)) {
    if (seen.has(doc.name)) continue;
    files.push({
      key: `visit-${doc.type}-${doc.name}`,
      guest: "",
      label: docLabel(doc.type),
      name: doc.name,
      href: guestDocHref(visitId, doc.type, undefined, doc.stored),
    });
  }
  if (!files.length && !showEmpty) return null;
  return (
    <div className={className}>
      {heading ? <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">{heading}</div> : null}
      {!files.length ? <p className={`text-[13px] text-[var(--muted)] ${heading ? "mt-2" : ""}`}>No attachments uploaded.</p> : null}
      {files.length ? (
    <ul className={`space-y-2 ${heading ? "mt-2" : ""}`}>
      {files.map((file) => (
        <li key={file.key}>
          <a className="text-[13px] font-medium text-[var(--brand-ink)]" href={file.href} target="_blank" rel="noopener noreferrer">
            {file.name}
          </a>
          <div className="text-[12px] text-[var(--muted)]">{file.guest ? `${file.guest} · ${file.label}` : file.label}</div>
        </li>
      ))}
    </ul>
      ) : null}
    </div>
  );
}
