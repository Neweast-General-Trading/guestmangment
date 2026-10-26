"use client";

import { useMemo, useRef, useState } from "react";
import {
  addDisplayScreenAction,
  prepareDisplaySetupAction,
  publishDisplaySetupAction,
  updateDisplayScreenAction,
} from "@/app/display-actions";
import { DisplayGallery } from "@/components/display-gallery";
import { FormBusy } from "@/components/form-busy";
import { Button, Card, Field, Textarea, TextInput, inputClass } from "@/components/ui";
import { displayImageSrc, friendlyScreenName, HQ_DISPLAY_SLUG, screenDisplayHref } from "@/lib/display-label";
import type { DisplayMediaRow, DisplayScreenRow, DisplaySetupRow } from "@/lib/display";

function blobToFile(blob: Blob) {
  return new File([blob], "welcome.jpg", { type: "image/jpeg" });
}

function encodePhoto(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the photo."))), "image/jpeg", quality);
  });
}

async function fitPhoto(file: File) {
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read the photo."));
      image.src = url;
    });
    const longest = Math.max(image.width, image.height);
    const scale = longest > 1920 ? 1920 / longest : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the photo.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.84;
    let blob = await encodePhoto(canvas, quality);
    while (blob.size > 900_000 && quality > 0.55) {
      quality -= 0.08;
      blob = await encodePhoto(canvas, quality);
    }
    return blobToFile(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ScreenSetupForm({
  screens,
  gallery,
  draft,
  live,
  canPublish,
}: {
  screens: DisplayScreenRow[];
  gallery: DisplayMediaRow[];
  draft: DisplaySetupRow | null;
  live: DisplaySetupRow | null;
  canPublish: boolean;
}) {
  const working = draft || live;
  const fileRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState(working?.message || "");
  const [preview, setPreview] = useState(working?.imagePath ? displayImageSrc(working.imagePath) : "");
  const [imagePath] = useState(working?.imagePath || "");
  const [target, setTarget] = useState<"ALL" | "SELECTED">(working?.target === "SELECTED" ? "SELECTED" : "ALL");
  const [picked, setPicked] = useState<string[]>(working?.screenIds || []);
  const [screenImages] = useState<Record<string, string>>(working?.screenImages || {});
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const rooms = screens.filter((item) => item.kind === "ROOM");
  const extras = screens.filter((item) => item.kind === "EXTRA");
  const assigned = useMemo(
    () => screens.filter((item) => item.active && (target === "ALL" || picked.includes(item.id))),
    [screens, target, picked],
  );
  const hqHref = `/display/${HQ_DISPLAY_SLUG}`;

  async function onPhoto(file?: File | null) {
    if (!file || !fileRef.current || !formRef.current) return;
    setBusyPhoto(true);
    setPhotoError("");
    try {
      const prepared = await fitPhoto(file);
      const transfer = new DataTransfer();
      transfer.items.add(prepared);
      fileRef.current.files = transfer.files;
      setPreview(URL.createObjectURL(prepared));
      formRef.current.requestSubmit();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Could not save the photo.");
    } finally {
      setBusyPhoto(false);
    }
  }

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const tap =
    "inline-flex h-11 min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-[14px] font-medium md:flex-none";

  return (
    <div className="space-y-4 pb-28 md:pb-0">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
        <form ref={formRef} action={prepareDisplaySetupAction} className="space-y-4">
          <FormBusy label="Preparing welcome…" />
          <input ref={fileRef} type="file" name="image" accept="image/*" className="hidden" />
          <input type="hidden" name="target" value={target} />
          <input type="hidden" name="imagePath" value={imagePath} />
          {target === "SELECTED"
            ? picked.map((id) => <input key={id} type="hidden" name="screenId" value={id} />)
            : null}
          {Object.entries(screenImages).map(([id, path]) => (
            <input key={id} type="hidden" name={`screenImage_${id}`} value={path} />
          ))}

          <Card>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Prepare</div>
                <h2 className="mt-1 text-[16px] font-semibold md:text-sm">Photo for the 65" screens</h2>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  Upload a landscape photo. Save keeps it ready; Publish sends it out.
                </p>
              </div>
              <div className="hidden flex-wrap gap-2 md:flex">
                <DisplayGallery items={gallery} label="Gallery" />
                <Button type="submit" variant="secondary">
                  Save draft
                </Button>
                <Button type="submit" formAction={publishDisplaySetupAction} disabled={!preview && !picked.length}>
                  Publish
                </Button>
                {target === "ALL" ? (
                  <a
                    href={hqHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)]"
                  >
                    Open
                  </a>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <button
                  type="button"
                  onClick={() => pickerRef.current?.click()}
                  className="relative block aspect-video w-full overflow-hidden rounded-2xl border border-dashed border-[var(--line-strong)] bg-white text-left"
                >
                  {preview ? (
                    <img src={preview} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center text-[14px] text-[var(--muted)]">
                      <span className="font-medium text-[var(--ink)]">Upload a landscape photo</span>
                      <span className="mt-1 text-[12px]">Or open the gallery</span>
                    </span>
                  )}
                </button>
                <p className={`mt-2 text-[12px] ${photoError ? "text-[var(--brand-ink)]" : "text-[var(--muted)]"}`}>
                  {busyPhoto ? "Saving the photo…" : photoError || "The whole photo is saved. Nothing is cut off."}
                </p>
                <input
                  ref={pickerRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => void onPhoto(event.target.files?.[0])}
                />
              </div>

              <div className="space-y-4">
                <Field label="Note (optional)">
                  <Textarea
                    name="message"
                    maxLength={240}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="min-h-20 md:min-h-24"
                    placeholder="Only if the photo has no welcome text"
                  />
                </Field>
                <div>
                  <div className="mb-2 text-[12px] font-medium text-[var(--muted)]">Show on</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTarget("ALL")}
                      className={`min-h-14 rounded-xl border px-3 py-3 text-left ${
                        target === "ALL" ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white"
                      }`}
                    >
                      <div className="text-[14px] font-medium">All screens</div>
                      <div className="mt-0.5 text-[12px] text-[var(--muted)]">Same photo everywhere</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTarget("SELECTED")}
                      className={`min-h-14 rounded-xl border px-3 py-3 text-left ${
                        target === "SELECTED" ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white"
                      }`}
                    >
                      <div className="text-[14px] font-medium">Selected</div>
                      <div className="mt-0.5 text-[12px] text-[var(--muted)]">A photo per screen</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
            <div className="flex gap-2">
              <DisplayGallery items={gallery} label="Gallery" className="min-w-0 w-full flex-1" />
              <Button type="submit" variant="secondary" className={`!h-11 !min-h-11 !flex-1 !px-3 !text-[14px] ${tap}`}>
                Save
              </Button>
            </div>
            <div className="mt-2 flex gap-2">
              <Button type="submit" formAction={publishDisplaySetupAction} disabled={!preview && !picked.length} className={`!h-11 !min-h-11 !flex-1 !px-3 !text-[14px] ${tap}`}>
                Publish
              </Button>
              {target === "ALL" ? (
                <a
                  href={hqHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 min-h-11 flex-1 items-center justify-center rounded-lg border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[14px] font-medium text-[var(--brand-ink)]"
                >
                  Open
                </a>
              ) : null}
            </div>
          </div>
        </form>

        <Card tone="sand" className="hidden md:block">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">
                {canPublish ? "Prepared · not on screens" : live ? "On the screens" : "Preview"}
              </div>
              <h2 className="mt-1 text-sm font-semibold">65" landscape television</h2>
            </div>
            {target === "ALL" ? (
              <a
                href={hqHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center rounded-md border border-[var(--brand)] bg-[var(--brand-soft)] px-3 text-[12px] font-medium text-[var(--brand-ink)]"
              >
                Open
              </a>
            ) : null}
          </div>
          <a
            href={hqHref}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block w-full rounded-2xl bg-[#14110f] p-3 text-left"
          >
            <div className="relative aspect-video overflow-hidden rounded-[12px] bg-white">
              {preview ? (
                <img src={preview} alt="" className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-[var(--faint)]">
                  Landscape photo fills the 65" screen
                </div>
              )}
            </div>
          </a>
          <p className="mt-3 text-[12px] text-[var(--muted)]">
            {assigned.length} screen{assigned.length === 1 ? "" : "s"} after you publish.
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Screens</div>
            <h2 className="mt-1 text-sm font-semibold">Meeting rooms and extra televisions</h2>
          </div>
          <span className="rounded-full bg-[#f7f2f2] px-2.5 py-1 text-[11px] text-[var(--muted)]">{screens.length} screens</span>
        </div>

        <form action={addDisplayScreenAction} className="mt-4 rounded-2xl border border-[var(--brand)] bg-[var(--brand-soft)] p-4">
          <FormBusy label="Adding screen…" />
          <div className="text-[13px] font-semibold text-[var(--brand-ink)]">Add a screen</div>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">Use this for a lobby, canteen, or any television that is not a meeting room.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]">
            <TextInput name="name" required placeholder="Screen name, e.g. Reception lobby" className="h-11" />
            <select name="sizeInches" defaultValue="65" className={`${inputClass} h-11`}>
              <option value="60">60 inch</option>
              <option value="65">65 inch</option>
            </select>
            <Button type="submit" className="!h-11 !text-[14px] md:!h-8 md:!text-[12px]">
              Add screen
            </Button>
          </div>
        </form>

        <ScreenGroup
          title="Meeting rooms"
          items={rooms}
          screens={screens}
          target={target}
          picked={picked}
          onToggle={toggle}
          screenImages={screenImages}
          gallery={gallery}
        />
        <ScreenGroup
          title="Other screens"
          items={extras}
          screens={screens}
          target={target}
          picked={picked}
          onToggle={toggle}
          screenImages={screenImages}
          gallery={gallery}
          removable
        />
      </Card>
    </div>
  );
}

function ScreenGroup({
  title,
  items,
  screens,
  target,
  picked,
  onToggle,
  screenImages,
  gallery,
  removable,
}: {
  title: string;
  items: DisplayScreenRow[];
  screens: DisplayScreenRow[];
  target: "ALL" | "SELECTED";
  picked: string[];
  onToggle: (id: string) => void;
  screenImages: Record<string, string>;
  gallery: DisplayMediaRow[];
  removable?: boolean;
}) {
  if (!items.length) {
    return (
      <div className="mt-6">
        <div className="text-[12px] font-medium text-[var(--muted)]">{title}</div>
        <p className="mt-2 text-[13px] text-[var(--faint)]">None yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-3 text-[12px] font-medium text-[var(--muted)]">{title}</div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((screen) => {
          const checked = target === "ALL" || picked.includes(screen.id);
          const photo = screenImages[screen.id];
          const href = screenDisplayHref(screen, screens);
          return (
            <li
              key={screen.id}
              className={`overflow-hidden rounded-2xl border ${
                checked ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white"
              }`}
            >
              {target === "SELECTED" && checked ? (
                <a href={href} target="_blank" rel="noreferrer" className="relative block aspect-video w-full bg-white">
                  {photo ? (
                    <img src={displayImageSrc(photo)} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[12px] text-[var(--faint)]">
                      Add a photo
                    </span>
                  )}
                </a>
              ) : null}
              <div className="p-3">
                <label className="flex min-h-11 items-start gap-3 md:min-h-0">
                  {target === "SELECTED" ? (
                    <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--brand)]" checked={checked} onChange={() => onToggle(screen.id)} />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium md:text-[13px]">{friendlyScreenName(screen.name)}</span>
                    <span className="mt-0.5 inline-flex rounded-full bg-white/80 px-2 py-0.5 text-[12px] text-[var(--muted)] md:text-[11px]">
                      {screen.sizeInches}" landscape
                    </span>
                  </span>
                </label>
                {(target === "SELECTED" && checked) || removable ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {target === "SELECTED" && checked ? (
                      <>
                        <DisplayGallery items={gallery} screenId={screen.id} label="Photo" className="!w-full" />
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--brand)] bg-white px-4 text-[14px] font-medium text-[var(--brand-ink)] md:h-8 md:text-[12px]"
                        >
                          Open
                        </a>
                      </>
                    ) : null}
                    {removable ? (
                      <form action={updateDisplayScreenAction} className="col-span-2">
                        <input type="hidden" name="id" value={screen.id} />
                        <button name="active" value="0" className="h-11 text-[13px] text-[var(--muted)] hover:text-[var(--ink)] md:h-auto md:text-[11px]">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
