"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { Field, Select, TextInput, Textarea } from "@/components/ui";
import { HOTEL_STATUSES, PICKUP_TYPES } from "@/lib/hospitality";
import {
  GUEST_NEED_PAGE_SIZE,
  GUEST_NEEDS,
  NEED_CATEGORIES,
  filterNeeds,
  flagsFromNeeds,
  pageItems,
  selectedFromVisit,
  stringifyGuestNeeds,
  type GuestNeedDef,
  type SelectedNeed,
} from "@/lib/guest-needs";
import type { FullVisit } from "@/lib/visits";

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={`chip ${on ? "on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

type Draft = { code: string; notes: string; mode: "add" | "edit" };

function extraKind(code: string, maps?: string) {
  if (code === "FROM_ABROAD" || maps === "abroad") return "abroad";
  if (maps === "hotel" || code === "LATE_HOTEL" || code === "EXTRA_NIGHTS" || code === "HOTEL_UPGRADE") return "hotel";
  if (maps === "pickup" || maps === "dropoff") return "pickup";
  if (maps === "breakfast" || maps === "lunch" || maps === "dinner" || code === "DIETARY") return "meals";
  return null;
}

export function GuestNeedsFields({ visit, catalog = GUEST_NEEDS }: { visit?: FullVisit; catalog?: GuestNeedDef[] }) {
  const [oneTime, setOneTime] = useState(visit ? Boolean(visit.oneTimeVisit) : true);
  const [qrRequired, setQrRequired] = useState(visit?.qrCheckInRequired !== false);
  const [nights, setNights] = useState(visit?.stayNights ?? 1);
  const [selected, setSelected] = useState<SelectedNeed[]>(() => (visit ? selectedFromVisit(visit) : []));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [hotelName, setHotelName] = useState(visit?.hotelName ?? "");
  const [hotelBookingStatus, setHotelBookingStatus] = useState(visit?.hotelBookingStatus ?? "REQUESTED");
  const [hotelRoomType, setHotelRoomType] = useState(visit?.hotelRoomType ?? "");
  const [pickupType, setPickupType] = useState(visit?.pickupType ?? "HQ_CAR");
  const [pickupFrom, setPickupFrom] = useState(visit?.pickupFrom ?? "");
  const [pickupTime, setPickupTime] = useState(visit?.pickupTime ?? "");
  const [dietaryNeeds, setDietaryNeeds] = useState(visit?.dietaryNeeds ?? "");
  const [originCountry, setOriginCountry] = useState(visit?.originCountry ?? "");
  const [originCity, setOriginCity] = useState(visit?.originCity ?? "");
  const [flightArrival, setFlightArrival] = useState(visit?.flightArrival ?? "");
  const [flightDeparture, setFlightDeparture] = useState(visit?.flightDeparture ?? "");
  const [stayFrom, setStayFrom] = useState(visit?.stayFrom ? format(visit.stayFrom, "yyyy-MM-dd") : "");
  const [stayTo, setStayTo] = useState(visit?.stayTo ? format(visit.stayTo, "yyyy-MM-dd") : "");

  const byCode = useMemo(() => Object.fromEntries(catalog.map((item) => [item.code, item])), [catalog]);
  const flags = flagsFromNeeds(selected);
  const filtered = useMemo(() => filterNeeds(catalog, query, category), [catalog, query, category]);
  const paged = pageItems(filtered, page, GUEST_NEED_PAGE_SIZE);
  const draftDef = draft ? byCode[draft.code] : null;
  const extras = draft ? extraKind(draft.code, draftDef?.maps) : null;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (draft) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [draft]);

  function goPage(next: number) {
    setPage(Math.min(paged.pages, Math.max(1, next)));
  }

  function setFilter(nextCategory: string, nextQuery = query) {
    setCategory(nextCategory);
    setQuery(nextQuery);
    setPage(1);
  }

  function openNeed(code: string) {
    const existing = selected.find((item) => item.code === code);
    setDraft({ code, notes: existing?.notes ?? "", mode: existing ? "edit" : "add" });
  }

  function confirmDraft() {
    if (!draft) return;
    setSelected((list) => {
      const rest = list.filter((item) => item.code !== draft.code);
      return [...rest, { code: draft.code, notes: draft.notes.trim() }];
    });
    setDraft(null);
  }

  function removeDraft() {
    if (!draft) return;
    setSelected((list) => list.filter((item) => item.code !== draft.code));
    setDraft(null);
  }

  function removeCode(code: string) {
    setSelected((list) => list.filter((item) => item.code !== code));
  }

  return (
    <section className="rounded-[10px] border border-[var(--line)] bg-white p-4">
      <h2 className="text-sm font-medium">Guest needs</h2>
      <p className="text-[12px] text-[var(--muted)]">Services for this guest, and how they check in at HQ.</p>

      <div className="mt-3">
        <div className="text-[12px] font-medium text-[var(--muted)]">QR check-in required?</div>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          <CheckInChoice
            on={qrRequired}
            onClick={() => setQrRequired(true)}
            title="Yes — guest presents QR"
            detail="Show invitation QR at the gate"
          />
          <CheckInChoice
            on={!qrRequired}
            onClick={() => setQrRequired(false)}
            title="No — guard records it"
            detail="Guard checks in and out on the visit"
          />
        </div>
      </div>

      <input type="hidden" name="fromAbroad" value={flags.fromAbroad ? "on" : "off"} />
      <input type="hidden" name="oneTimeVisit" value={oneTime ? "on" : "off"} />
      <input type="hidden" name="qrCheckInRequired" value={qrRequired ? "on" : "off"} />
      <input type="hidden" name="guestNeedsJson" value={stringifyGuestNeeds(selected)} />
      <input type="hidden" name="hotelRequired" value={flags.hotelRequired ? "on" : "off"} />
      <input type="hidden" name="pickupRequired" value={flags.pickupRequired ? "on" : "off"} />
      <input type="hidden" name="dropoffRequired" value={flags.dropoffRequired ? "on" : "off"} />
      <input type="hidden" name="mealBreakfast" value={flags.mealBreakfast ? "on" : "off"} />
      <input type="hidden" name="mealLunch" value={flags.mealLunch ? "on" : "off"} />
      <input type="hidden" name="mealDinner" value={flags.mealDinner ? "on" : "off"} />
      <input type="hidden" name="stayNights" value={flags.fromAbroad ? String(nights) : ""} />
      <input type="hidden" name="hotelName" value={hotelName} />
      <input type="hidden" name="hotelBookingStatus" value={hotelBookingStatus} />
      <input type="hidden" name="hotelRoomType" value={hotelRoomType} />
      <input type="hidden" name="pickupType" value={pickupType} />
      <input type="hidden" name="pickupFrom" value={pickupFrom} />
      <input type="hidden" name="pickupTime" value={pickupTime} />
      <input type="hidden" name="dietaryNeeds" value={dietaryNeeds} />
      <input type="hidden" name="originCountry" value={originCountry} />
      <input type="hidden" name="originCity" value={originCity} />
      <input type="hidden" name="flightArrival" value={flightArrival} />
      <input type="hidden" name="flightDeparture" value={flightDeparture} />
      <input type="hidden" name="stayFrom" value={stayFrom} />
      <input type="hidden" name="stayTo" value={stayTo} />

      <div className="mt-4">
        <Chip on={oneTime} onClick={() => setOneTime((value) => !value)}>
          One-time visit
        </Chip>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)]">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input
              value={query}
              onChange={(event) => setFilter(category, event.target.value)}
              placeholder="Search services"
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[var(--brand)]"
            />
          </div>
          <div className="text-[12px] text-[var(--muted)]">
            {paged.total === 0 ? "No services" : `${paged.from}–${paged.to} of ${paged.total}`}
            {selected.length ? ` · ${selected.length} added` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {NEED_CATEGORIES.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setFilter(item.code)}
              className={`h-8 rounded-full px-3 text-[12px] ${
                category === item.code ? "bg-[var(--brand)] text-white" : "bg-[#f4ecec] text-[var(--muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 border-t border-[var(--line)] p-3 sm:grid-cols-2">
          {paged.slice.map((item) => {
            const row = selected.find((entry) => entry.code === item.code);
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => openNeed(item.code)}
                className={`rounded-xl border p-3 text-left transition ${
                  row ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white hover:border-[var(--line-strong)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-medium">{item.label}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--muted)]">{item.hint}</div>
                  </div>
                  <span
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      row ? "bg-[var(--brand)] text-white" : "border border-[var(--line)] text-[var(--faint)]"
                    }`}
                  >
                    {row ? <Check size={13} strokeWidth={2.4} /> : <Plus size={13} strokeWidth={2.2} />}
                  </span>
                </div>
                {row?.notes ? <p className="mt-2 line-clamp-2 text-[12px] text-[var(--brand-ink)]">{row.notes}</p> : null}
              </button>
            );
          })}
          {paged.total === 0 ? (
            <p className="col-span-full py-8 text-center text-[13px] text-[var(--muted)]">Nothing matches this filter.</p>
          ) : null}
        </div>

        {selected.length ? (
          <div className="flex flex-wrap gap-1.5 border-t border-[var(--line)] px-3 py-2">
            {selected.map((item) => (
              <span key={item.code} className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] py-1 pl-2.5 pr-1 text-[11px] font-medium text-[var(--brand-ink)]">
                <button type="button" onClick={() => openNeed(item.code)}>
                  {byCode[item.code]?.label}
                </button>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-white"
                  onClick={() => removeCode(item.code)}
                  aria-label={`Remove ${byCode[item.code]?.label}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <Pager page={paged.page} pages={paged.pages} onPage={goPage} />
      </div>

      <div className="mt-4">
        <Field label="Other hospitality notes">
          <Textarea name="hospitalityNotes" defaultValue={visit?.hospitalityNotes ?? ""} placeholder="Anything that is not in the catalogue…" />
        </Field>
      </div>

      <dialog
        ref={dialogRef}
        className="need-dialog"
        onClose={() => setDraft(null)}
        onCancel={(event) => {
          event.preventDefault();
          setDraft(null);
        }}
      >
        {draftDef && draft ? (
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium tracking-[0.14em] text-[var(--brand)]">
                  {draft.mode === "edit" ? "EDIT SERVICE" : "ADD SERVICE"}
                </div>
                <h3 className="mt-1 text-[18px] font-medium tracking-tight">{draftDef.label}</h3>
                <p className="mt-1 text-[13px] text-[var(--muted)]">{draftDef.hint}</p>
              </div>
              <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[#f4ecec]" onClick={() => setDraft(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {extras === "abroad" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Country">
                  <TextInput value={originCountry} onChange={(event) => setOriginCountry(event.target.value)} placeholder="Italy" />
                </Field>
                <Field label="City">
                  <TextInput value={originCity} onChange={(event) => setOriginCity(event.target.value)} placeholder="Milan" />
                </Field>
                <Field label="Arrival flight">
                  <TextInput value={flightArrival} onChange={(event) => setFlightArrival(event.target.value)} placeholder="AZ 826 / 12:10" />
                </Field>
                <Field label="Return flight">
                  <TextInput value={flightDeparture} onChange={(event) => setFlightDeparture(event.target.value)} placeholder="AZ 827 / 18:40" />
                </Field>
                <div>
                  <div className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">Nights</div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="h-9 w-9 rounded-lg border border-[var(--line)] bg-white" onClick={() => setNights((n) => Math.max(1, n - 1))}>
                      −
                    </button>
                    <div className="min-w-8 text-center text-sm font-medium">{nights}</div>
                    <button type="button" className="h-9 w-9 rounded-lg border border-[var(--line)] bg-white" onClick={() => setNights((n) => n + 1)}>
                      +
                    </button>
                  </div>
                </div>
                <Field label="Stay from">
                  <TextInput type="date" value={stayFrom} onChange={(event) => setStayFrom(event.target.value)} />
                </Field>
                <Field label="Stay until">
                  <TextInput type="date" value={stayTo} onChange={(event) => setStayTo(event.target.value)} />
                </Field>
              </div>
            ) : null}

            {extras === "hotel" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Hotel name">
                  <TextInput value={hotelName} onChange={(event) => setHotelName(event.target.value)} placeholder="Four Seasons" />
                </Field>
                <Field label="Booking status">
                  <Select value={hotelBookingStatus} onChange={(event) => setHotelBookingStatus(event.target.value)}>
                    {HOTEL_STATUSES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Room type">
                  <TextInput value={hotelRoomType} onChange={(event) => setHotelRoomType(event.target.value)} placeholder="Deluxe twin" />
                </Field>
              </div>
            ) : null}

            {extras === "pickup" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Transfer type">
                  <Select value={pickupType} onChange={(event) => setPickupType(event.target.value)}>
                    {PICKUP_TYPES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Pickup / wait at">
                  <TextInput value={pickupFrom} onChange={(event) => setPickupFrom(event.target.value)} placeholder="BEY airport arrivals" />
                </Field>
                <Field label="Time">
                  <TextInput type="time" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} />
                </Field>
              </div>
            ) : null}

            {extras === "meals" ? (
              <div className="mt-4">
                <Field label="Dietary needs">
                  <TextInput value={dietaryNeeds} onChange={(event) => setDietaryNeeds(event.target.value)} placeholder="Vegetarian, no nuts…" />
                </Field>
              </div>
            ) : null}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">Notes for this service</span>
              <textarea
                autoFocus={extras === null}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value.slice(0, 240) })}
                placeholder="Anything else the host should know…"
                className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-[#faf7f7] px-3 py-2 text-[13px] outline-none focus:border-[var(--brand)] focus:bg-white"
              />
            </label>
            <div className="mt-5 flex items-center justify-end gap-2">
              {draft.mode === "edit" ? (
                <button type="button" className="mr-auto h-10 rounded-lg px-3 text-[13px] text-[#b14a42]" onClick={removeDraft}>
                  Remove
                </button>
              ) : (
                <button type="button" className="h-10 rounded-lg px-3 text-[13px] text-[var(--muted)]" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              )}
              <button type="button" className="h-10 rounded-lg bg-[var(--brand)] px-5 text-[13px] font-medium text-white" onClick={confirmDraft}>
                {draft.mode === "edit" ? "Save" : "Add service"}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}

function CheckInChoice({
  on,
  onClick,
  title,
  detail,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${
        on ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white"
      }`}
    >
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
          on ? "border-[var(--brand)] bg-[var(--brand)]" : "border-[var(--line-strong)] bg-white"
        }`}
      >
        {on ? <span className="h-1 w-1 rounded-full bg-white" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium leading-tight">{title}</span>
        <span className="block text-[11px] text-[var(--muted)]">{detail}</span>
      </span>
    </button>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  const windowed = pageNumbers(page, pages);
  return (
    <nav aria-label="Service catalogue pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] p-3">
      <div className="flex flex-wrap items-center gap-1">
        <PageBtn onClick={() => onPage(1)} disabled={page === 1}>
          First
        </PageBtn>
        <PageBtn onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page">
          <ChevronLeft size={14} />
        </PageBtn>
        {windowed.map((item, index) =>
          item === "…" ? (
            <span key={`e${index}`} className="px-1 text-[12px] text-[var(--faint)]">
              …
            </span>
          ) : (
            <PageBtn key={item} onClick={() => onPage(item)} current={item === page}>
              {item}
            </PageBtn>
          ),
        )}
        <PageBtn onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Next page">
          <ChevronRight size={14} />
        </PageBtn>
        <PageBtn onClick={() => onPage(pages)} disabled={page === pages}>
          Last
        </PageBtn>
      </div>
      <span className="text-[12px] text-[var(--muted)]">
        {page} / {pages}
      </span>
    </nav>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  current,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  current?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[12px] ${
        current ? "bg-[var(--brand)] font-medium text-white" : "border border-[var(--line)] bg-white text-[var(--ink)]"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function pageNumbers(page: number, pages: number): Array<number | "…"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const n = sorted[i];
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  }
  return out;
}

export { GuestNeedsFields as HospitalityFields };
