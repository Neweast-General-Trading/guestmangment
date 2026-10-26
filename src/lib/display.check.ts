import assert from "node:assert/strict";
import { displayRoomLabel, imageForScreen, kioskImage, kioskRoomLabel } from "./display";

const live = {
  id: "live",
  message: "Welcome",
  imagePath: "/hq.jpg",
  target: "ALL",
  screenIds: [] as string[],
  screenImages: {} as Record<string, string>,
  status: "LIVE",
  publishedAt: new Date(),
};

const draft = {
  ...live,
  id: "draft",
  status: "DRAFT",
  publishedAt: null,
  screenImages: { tokyo: "/brembo.jpg" },
};

assert.equal(imageForScreen(live, "tokyo"), "/hq.jpg");
assert.equal(imageForScreen(draft, "tokyo"), "/brembo.jpg");
assert.equal(kioskImage(live, draft, "tokyo"), "/brembo.jpg");
assert.equal(kioskImage(live, draft, "canteen"), "/hq.jpg");
assert.equal(displayRoomLabel(live, "Tokyo"), "NEWEAST HQ");
assert.equal(kioskRoomLabel(live, draft, "Tokyo", "tokyo"), "Tokyo");
assert.equal(kioskRoomLabel(live, draft, "Canteen", "canteen"), "NEWEAST HQ");

console.log("display.check: ok");
