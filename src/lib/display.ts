import { displaySlug, friendlyScreenName, isHqDisplaySlug } from "./display-label";
import { resolveDisplayMedia, saveUploadedDisplayImage } from "./display-media";
import { makeQrToken } from "./ids";
import { graphConfigured, listHqRooms, roomKey } from "./graph";
import { prisma } from "./prisma";

export { saveUploadedDisplayImage };

export { friendlyScreenName };

export const DISPLAY_SIZES = [60, 65] as const;
export const DEFAULT_WELCOME = "Welcome to NEWEAST Headquarters.";

export type DisplayScreenRow = {
  id: string;
  name: string;
  kind: string;
  roomKey: string | null;
  roomEmail: string | null;
  sizeInches: number;
  token: string;
  active: boolean;
};

export type DisplaySetupRow = {
  id: string;
  message: string;
  imagePath: string;
  target: string;
  screenIds: string[];
  screenImages: Record<string, string>;
  status: string;
  publishedAt: Date | null;
};

export type DisplayMediaRow = {
  id: string;
  path: string;
  createdAt: Date;
};

function parseImages(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

function parseIds(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function displayUrl(token: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${base}/display/${token}`;
}

export function setupTargetsScreen(setup: DisplaySetupRow | null, screenId: string) {
  if (!setup) return false;
  if (setup.target === "ALL") return true;
  return setup.screenIds.includes(screenId);
}

function toSetup(row: {
  id: string;
  message: string;
  imagePath: string;
  target: string;
  screenIds: string;
  screenImages: string;
  status: string;
  publishedAt: Date | null;
}): DisplaySetupRow {
  return {
    id: row.id,
    message: row.message,
    imagePath: row.imagePath,
    target: row.target,
    screenIds: parseIds(row.screenIds),
    screenImages: parseImages(row.screenImages),
    status: row.status,
    publishedAt: row.publishedAt,
  };
}

export function displayRoomLabel(setup: DisplaySetupRow | null, screenName: string, screenId?: string) {
  if (screenId && setup?.screenImages[screenId]) return friendlyScreenName(screenName);
  if (!setup || setup.target === "ALL") return "NEWEAST HQ";
  return friendlyScreenName(screenName);
}

export function imageForScreen(setup: DisplaySetupRow | null, screenId: string) {
  if (!setup) return "";
  if (screenId && setup.screenImages[screenId]) return setup.screenImages[screenId];
  return setup.imagePath || "";
}

export function kioskImage(live: DisplaySetupRow | null, draft: DisplaySetupRow | null, screenId: string) {
  return (
    (screenId && (draft?.screenImages[screenId] || live?.screenImages[screenId])) ||
    imageForScreen(live, screenId) ||
    imageForScreen(draft, screenId) ||
    ""
  );
}

export function kioskRoomLabel(
  live: DisplaySetupRow | null,
  draft: DisplaySetupRow | null,
  screenName: string,
  screenId: string,
) {
  if (screenId && (draft?.screenImages[screenId] || live?.screenImages[screenId])) {
    return friendlyScreenName(screenName);
  }
  return displayRoomLabel(live || draft, screenName, screenId);
}

export async function liveDisplaySetup(): Promise<DisplaySetupRow | null> {
  const row = await prisma.displaySetup.findFirst({
    where: { status: "LIVE" },
    orderBy: { publishedAt: "desc" },
  });
  return row ? toSetup(row) : null;
}

export async function draftDisplaySetup(): Promise<DisplaySetupRow | null> {
  const row = await prisma.displaySetup.findFirst({
    where: { status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
  });
  return row ? toSetup(row) : null;
}

export async function currentDisplaySetup(): Promise<DisplaySetupRow | null> {
  return (await draftDisplaySetup()) || (await liveDisplaySetup());
}

export function setupLooksSame(left: DisplaySetupRow | null, right: DisplaySetupRow | null) {
  if (!left || !right) return false;
  return (
    left.message === right.message &&
    left.imagePath === right.imagePath &&
    left.target === right.target &&
    JSON.stringify(left.screenIds) === JSON.stringify(right.screenIds) &&
    JSON.stringify(left.screenImages) === JSON.stringify(right.screenImages)
  );
}

async function ensureDefaultSetup() {
  if (await prisma.displaySetup.findFirst({ select: { id: true } })) return;
  await prisma.displaySetup.create({
    data: {
      message: DEFAULT_WELCOME,
      imagePath: "/uploads/displays/default.svg",
      target: "ALL",
      screenIds: "[]",
      screenImages: "{}",
      status: "LIVE",
      publishedAt: new Date(),
    },
  });
}

export async function listDisplayMedia(): Promise<DisplayMediaRow[]> {
  await ensureDisplayGallery();
  return prisma.displayMedia.findMany({ orderBy: { createdAt: "desc" } });
}

export async function addDisplayMedia(path: string) {
  const exists = await prisma.displayMedia.findFirst({ where: { path } });
  if (exists) return exists;
  return prisma.displayMedia.create({ data: { path } });
}

async function ensureDisplayGallery() {
  const known = ["/api/display/media/welcome-hq", "/api/display/media/1790747264738-e652e30f", "/api/display/media/default"];
  for (const item of known) {
    const stem = item.split("/").pop() || "";
    if (!resolveDisplayMedia(stem)) continue;
    if (!(await prisma.displayMedia.findFirst({ where: { path: item } }))) {
      await prisma.displayMedia.create({ data: { path: item } });
    }
  }
}

export async function ensureDisplayScreens() {
  let rooms: Awaited<ReturnType<typeof listHqRooms>> = [];
  try {
    if (graphConfigured()) rooms = await listHqRooms();
  } catch {
    rooms = [];
  }

  for (const room of rooms) {
    const key = roomKey(room.email || room.name);
    if (!key) continue;
    await prisma.displayScreen.upsert({
      where: { roomKey: key },
      update: { name: room.name, roomEmail: room.email, kind: "ROOM", active: true },
      create: {
        name: room.name,
        kind: "ROOM",
        roomKey: key,
        roomEmail: room.email,
        sizeInches: 65,
        token: makeQrToken(),
        active: true,
      },
    });
  }

  const extras = await prisma.displayScreen.count({ where: { kind: "EXTRA" } });
  if (extras === 0) {
    await prisma.displayScreen.createMany({
      data: [
        { name: "Reception lobby", kind: "EXTRA", sizeInches: 65, token: makeQrToken(), active: true },
        { name: "HQ entrance", kind: "EXTRA", sizeInches: 65, token: makeQrToken(), active: true },
      ],
    });
  }
  await ensureDefaultSetup();
}

export async function listDisplayScreens(): Promise<DisplayScreenRow[]> {
  await ensureDisplayScreens();
  return prisma.displayScreen.findMany({
    orderBy: [{ kind: "desc" }, { name: "asc" }],
  });
}

export async function addExtraScreen(name: string, sizeInches: number) {
  const label = name.trim();
  if (!label) throw new Error("Give the screen a name.");
  if (!DISPLAY_SIZES.includes(sizeInches as (typeof DISPLAY_SIZES)[number])) {
    throw new Error("Choose 60 or 65 inches.");
  }
  return prisma.displayScreen.create({
    data: { name: label, kind: "EXTRA", sizeInches, token: makeQrToken(), active: true },
  });
}

export async function setScreenSize(id: string, sizeInches: number) {
  if (!DISPLAY_SIZES.includes(sizeInches as (typeof DISPLAY_SIZES)[number])) {
    throw new Error("Choose 60 or 65 inches.");
  }
  await prisma.displayScreen.update({ where: { id }, data: { sizeInches } });
}

export async function setScreenActive(id: string, active: boolean) {
  const screen = await prisma.displayScreen.findUniqueOrThrow({ where: { id } });
  if (screen.kind === "ROOM" && !active) throw new Error("Meeting-room screens stay on the list.");
  await prisma.displayScreen.update({ where: { id }, data: { active } });
}


function preparedFields(input: {
  message: string;
  imagePath: string;
  target: "ALL" | "SELECTED";
  screenIds: string[];
  screenImages: Record<string, string>;
}) {
  const message = input.message.trim();
  if (message.length > 240) throw new Error("Keep the welcome under 240 characters.");
  if (input.target === "SELECTED" && input.screenIds.length === 0) {
    throw new Error("Pick at least one screen, or choose all screens.");
  }
  if (input.target === "ALL" && !input.imagePath) throw new Error("Add a photo, or pick one from the gallery.");
  if (input.target === "SELECTED") {
    const missing = input.screenIds.filter((id) => !input.screenImages[id] && !input.imagePath);
    if (missing.length) throw new Error("Add a photo for each selected screen, or pick one from the gallery.");
  }
  return {
    message: message || DEFAULT_WELCOME,
    imagePath: input.imagePath,
    target: input.target,
    screenIds: JSON.stringify(input.screenIds),
    screenImages: JSON.stringify(input.screenImages),
  };
}

export async function saveDisplayDraft(input: {
  message: string;
  imagePath: string;
  target: "ALL" | "SELECTED";
  screenIds: string[];
  screenImages?: Record<string, string>;
  createdBy?: string;
}) {
  const data = preparedFields({ ...input, screenImages: input.screenImages || {} });
  const draft = await prisma.displaySetup.findFirst({
    where: { status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
  });
  if (draft) {
    return prisma.displaySetup.update({
      where: { id: draft.id },
      data: { ...data, createdBy: input.createdBy || draft.createdBy },
    });
  }
  return prisma.displaySetup.create({
    data: { ...data, status: "DRAFT", createdBy: input.createdBy || null },
  });
}

export async function publishDisplayDraft(createdBy?: string) {
  const draft = await prisma.displaySetup.findFirst({
    where: { status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
  });
  if (!draft) throw new Error("Prepare the welcome first, then publish.");
  const live = await prisma.displaySetup.update({
    where: { id: draft.id },
    data: { status: "LIVE", publishedAt: new Date(), createdBy: createdBy || draft.createdBy },
  });
  await prisma.displaySetup.create({
    data: {
      message: live.message,
      imagePath: live.imagePath,
      target: live.target,
      screenIds: live.screenIds,
      screenImages: live.screenImages,
      status: "DRAFT",
      createdBy: createdBy || live.createdBy,
    },
  });
  return live;
}

export async function displayForToken(token: string) {
  const screen = await prisma.displayScreen.findUnique({ where: { token } });
  if (!screen || !screen.active) return null;
  const live = await liveDisplaySetup();
  const draft = await draftDisplaySetup();
  const setup = live || draft;
  return {
    screen: {
      id: screen.id,
      name: screen.name,
      kind: screen.kind,
      sizeInches: screen.sizeInches,
    },
    roomLabel: kioskRoomLabel(live, draft, screen.name, screen.id),
    setup: setup
      ? { message: setup.message, imagePath: kioskImage(live, draft, screen.id) }
      : null,
  };
}

export async function displayForHq() {
  const live = await liveDisplaySetup();
  const setup = live || (await draftDisplaySetup());
  const screens = await prisma.displayScreen.findMany({ where: { active: true } });
  const screen = screens.find((item) => setupTargetsScreen(setup, item.id)) || screens[0] || null;
  return {
    screen: screen
      ? { id: screen.id, name: screen.name, kind: screen.kind, sizeInches: screen.sizeInches }
      : { id: "hq", name: "NEWEAST HQ", kind: "EXTRA", sizeInches: 65 },
    roomLabel: "NEWEAST HQ",
    setup: setup ? { message: setup.message, imagePath: setup.imagePath } : null,
  };
}

export async function displayForPath(param: string) {
  const key = decodeURIComponent(param || "").trim();
  if (!key) return null;
  if (isHqDisplaySlug(key)) return displayForHq();
  const byToken = await displayForToken(key);
  if (byToken) return byToken;
  const screens = await prisma.displayScreen.findMany({ where: { active: true } });
  const lower = key.toLowerCase();
  const match =
    screens.find((item) => `${displaySlug(item.name)}-${item.token.slice(0, 6)}` === lower) ||
    screens.find((item) => displaySlug(item.name) === lower);
  if (!match) return null;
  return displayForToken(match.token);
}

export async function previewDisplay(screenToken?: string | null) {
  const draft = await draftDisplaySetup();
  const live = await liveDisplaySetup();
  const setup = draft || live;
  const screens = await prisma.displayScreen.findMany({ where: { active: true } });
  const screen =
    (screenToken && screens.find((item) => item.token === screenToken || item.id === screenToken)) ||
    screens.find((item) => setupTargetsScreen(setup, item.id)) ||
    screens[0] ||
    null;
  return {
    screen: screen
      ? { id: screen.id, name: screen.name, kind: screen.kind, sizeInches: screen.sizeInches }
      : { id: "preview", name: "Preview", kind: "EXTRA", sizeInches: 65 },
    roomLabel: displayRoomLabel(setup, screen?.name || "Preview"),
    setup: setup
      ? { message: setup.message, imagePath: imageForScreen(setup, screen?.id || "") }
      : null,
  };
}
