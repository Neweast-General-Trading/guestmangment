"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import {
  addDisplayMedia,
  addExtraScreen,
  draftDisplaySetup,
  liveDisplaySetup,
  publishDisplayDraft,
  saveDisplayDraft,
  saveUploadedDisplayImage,
  setScreenActive,
  setScreenSize,
} from "@/lib/display";
import { canManageIntake } from "@/lib/permissions";

function refresh() {
  revalidatePath("/", "layout");
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not save the screen setup.";
  redirect(`/screens?error=${encodeURIComponent(message)}`);
}

function screenImagesFrom(formData: FormData) {
  const images: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("screenImage_") || typeof value !== "string" || !value) continue;
    images[key.slice("screenImage_".length)] = value;
  }
  return images;
}

async function imageFromForm(formData: FormData) {
  const picked = String(formData.get("imagePath") || "");
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const path = await saveUploadedDisplayImage(file);
    await addDisplayMedia(path);
    return path;
  }
  if (picked) return picked;
  const draft = await draftDisplaySetup();
  const live = await liveDisplaySetup();
  return draft?.imagePath || live?.imagePath || "";
}

async function saveFromForm(formData: FormData, userId: string) {
  const target = String(formData.get("target") || "ALL") === "SELECTED" ? "SELECTED" : "ALL";
  const screenIds = formData.getAll("screenId").map((item) => String(item)).filter(Boolean);
  const imagePath = await imageFromForm(formData);
  await saveDisplayDraft({
    message: String(formData.get("message") || ""),
    imagePath,
    target,
    screenIds,
    screenImages: screenImagesFrom(formData),
    createdBy: userId,
  });
  return { target, screenIds };
}

export async function prepareDisplaySetupAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  try {
    const saved = await saveFromForm(formData, session.id);
    await writeAudit({
      userId: session.id,
      action: "Screen welcome prepared",
      module: "Screens",
      newValue: { target: saved.target, screens: saved.screenIds.length },
    });
  } catch (error) {
    fail(error);
  }
  refresh();
  redirect("/screens?prepared=1");
}

export async function publishDisplaySetupAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  try {
    await saveFromForm(formData, session.id);
    await publishDisplayDraft(session.id);
    await writeAudit({ userId: session.id, action: "Screen welcome published", module: "Screens" });
  } catch (error) {
    fail(error);
  }
  refresh();
  redirect("/screens?published=1");
}

export async function addDisplayMediaAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  try {
    const file = formData.get("image");
    if (!(file instanceof File) || !file.size) throw new Error("Choose a photo to save.");
    const path = await saveUploadedDisplayImage(file);
    await addDisplayMedia(path);
    const draft = (await draftDisplaySetup()) || (await liveDisplaySetup());
    const screenId = String(formData.get("screenId") || "");
    const screenImages = { ...(draft?.screenImages || {}) };
    if (screenId) screenImages[screenId] = path;
    const screenIds = screenId
      ? Array.from(new Set([...(draft?.screenIds || []), screenId]))
      : draft?.screenIds || [];
    await saveDisplayDraft({
      message: draft?.message || "",
      imagePath: screenId ? draft?.imagePath || path : path,
      target: screenId ? "SELECTED" : draft?.target === "SELECTED" ? "SELECTED" : "ALL",
      screenIds,
      screenImages,
      createdBy: session.id,
    });
    await writeAudit({ userId: session.id, action: "Display photo saved", module: "Screens" });
  } catch (error) {
    fail(error);
  }
  refresh();
  redirect("/screens?prepared=1");
}

export async function pickDisplayMediaAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  try {
    const path = String(formData.get("path") || "");
    if (!path) throw new Error("Pick a photo from the gallery.");
    const draft = (await draftDisplaySetup()) || (await liveDisplaySetup());
    const screenId = String(formData.get("screenId") || "");
    const screenImages = { ...(draft?.screenImages || {}) };
    if (screenId) screenImages[screenId] = path;
    const screenIds = screenId
      ? Array.from(new Set([...(draft?.screenIds || []), screenId]))
      : draft?.screenIds || [];
    await saveDisplayDraft({
      message: draft?.message || "",
      imagePath: screenId ? draft?.imagePath || path : path,
      target: screenId ? "SELECTED" : draft?.target === "SELECTED" ? "SELECTED" : "ALL",
      screenIds,
      screenImages,
      createdBy: session.id,
    });
  } catch (error) {
    fail(error);
  }
  refresh();
  redirect("/screens?prepared=1");
}

export async function addDisplayScreenAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  try {
    await addExtraScreen(String(formData.get("name") || ""), Number(formData.get("sizeInches") || 65));
    await writeAudit({ userId: session.id, action: "Display screen added", module: "Screens" });
  } catch (error) {
    fail(error);
  }
  refresh();
  redirect("/screens?added=1");
}

export async function updateDisplayScreenAction(formData: FormData) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!canManageIntake(session.role)) redirect("/dashboard");
  const id = String(formData.get("id") || "");
  try {
    if (formData.has("sizeInches")) await setScreenSize(id, Number(formData.get("sizeInches")));
    if (formData.has("active")) await setScreenActive(id, String(formData.get("active")) === "1");
  } catch (error) {
    fail(error);
  }
  refresh();
  redirect("/screens");
}
