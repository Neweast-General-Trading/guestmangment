import { createRequire } from "node:module";
const require = createRequire("/tmp/guide-deck/package.json");
const PptxGenJS = require("pptxgenjs");

const LOGO = "/home/negt/HQ_NEWESAT_GUESTVISIT/public/neweast-logo.png";
const OUT = "/home/negt/HQ_NEWESAT_GUESTVISIT/docs/user-guide/NEWEAST-Guest-Management-Guide.pptx";

const INK = "1E1818";
const BRAND = "B51E21";
const MUTED = "6D6262";
const SOFT = "F4EEEC";
const WHITE = "FFFFFF";
const CARD = "FFFBFA";
const DARK = "161111";
const CREAM = "FBF8F6";
const PINK = "F8E4E4";

const pres = new PptxGenJS();
pres.defineLayout({ name: "NEWIDE", width: 13.333, height: 7.5 });
pres.layout = "NEWIDE";
pres.title = "NEWEAST Intranet — Guest Management";
pres.author = "NEWEAST Headquarters";
pres.subject = "Step-by-step process for every department";

function logo(slide, x, y, w = 2.15) {
  slide.addImage({ path: LOGO, x, y, w, h: w * (126 / 720) });
}

function kicker(slide, text, x = 0.6, y = 0.85, color = BRAND) {
  slide.addText(text, {
    x, y, w: 11, h: 0.28, fontFace: "Calibri", fontSize: 12, bold: true,
    color, charSpacing: 2.2, margin: 0, isTextBox: true,
  });
}

function title(slide, text, x, y, w = 11.4, color = INK) {
  slide.addText(text, {
    x, y, w, h: 0.7, fontFace: "Cambria", fontSize: 32, bold: true,
    color, margin: 0, isTextBox: true,
  });
}

function body(slide, text, x, y, w, h = 0.7, size = 16) {
  slide.addText(text, {
    x, y, w, h, fontFace: "Calibri", fontSize: size, color: MUTED, margin: 0, isTextBox: true,
  });
}

function card(slide, x, y, w, h, fill = CARD) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, fill: { color: fill }, rectRadius: 0.12,
    shadow: { type: "outer", color: "1E1818", blur: 10, opacity: 0.08, offset: 2, angle: 90 },
  });
}

function num(slide, n, x, y) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: 0.38, h: 0.38, fill: { color: BRAND } });
  slide.addText(String(n), {
    x, y, w: 0.38, h: 0.38, align: "center", valign: "middle",
    fontFace: "Calibri", fontSize: 13, bold: true, color: WHITE, margin: 0, isTextBox: true,
  });
}

function page(slide, n) {
  slide.addText(`${n}  ·  Guest Management  ·  Intranet module`, {
    x: 0.55, y: 7.12, w: 12.2, h: 0.22, fontFace: "Calibri", fontSize: 11,
    color: "A89C9C", margin: 0, isTextBox: true,
  });
}

// 1 Title
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: DARK } });
  s.addShape(pres.shapes.OVAL, { x: 9.4, y: -1.4, w: 5.6, h: 5.6, fill: { color: "2A1A1A" } });
  s.addShape(pres.shapes.OVAL, { x: -1.6, y: 4.2, w: 4.4, h: 4.4, fill: { color: "241616" } });
  logo(s, 0.7, 0.55, 2.4);
  kicker(s, "NEWEAST INTRANET MODULE", 0.7, 2.15, "F3B4B5");
  s.addText("Guest Management", {
    x: 0.7, y: 2.5, w: 11.5, h: 1.05, fontFace: "Cambria", fontSize: 48, color: WHITE, margin: 0, isTextBox: true,
  });
  s.addText("The Headquarters visitor path — from the first request to the gate.\nA process reference for every department.", {
    x: 0.7, y: 3.65, w: 10.4, h: 0.9, fontFace: "Calibri", fontSize: 18, color: "D8CCCC", margin: 0, isTextBox: true,
  });
  const chips = ["Requester", "Line manager", "Reception", "Marketing", "HR", "Guard"];
  chips.forEach((label, i) => {
    const x = 0.7 + (i % 6) * 2.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 5.0, w: 1.85, h: 0.42, fill: { color: i < 3 ? BRAND : "2C2222" }, rectRadius: 0.2,
    });
    s.addText(label, {
      x, y: 5.0, w: 1.85, h: 0.42, align: "center", valign: "middle",
      fontFace: "Calibri", fontSize: 13, color: WHITE, margin: 0, isTextBox: true,
    });
  });
  s.addText("intranet.neweast.cloud   ·   guest.neweast.cloud", {
    x: 0.7, y: 6.7, w: 10, h: 0.3, fontFace: "Calibri", fontSize: 14, color: "A89C9C", margin: 0, isTextBox: true,
  });
  s.addNotes("Open by saying this is a module of the Intranet, not a separate system. Roles, not departments, are the map.");
}

// 2 How to open
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "START HERE");
  title(s, "How to open the module", 0.6, 1.05);
  body(s, "Guest Management lives on the NEWEAST Intranet. You sign in with the same account you use at work.", 0.6, 1.75, 12);
  const opens = [
    { n: "01", h: "From the Intranet", t: "Go to intranet.neweast.cloud and open Guest Management." },
    { n: "02", h: "Direct link", t: "Go to guest.neweast.cloud. Bookmark it if you raise visits often." },
    { n: "03", h: "What you see", t: "The menu shows only the desks that belong to your role. An employee does not see the guard desk." },
  ];
  opens.forEach((item, i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 2.7, 3.9, 3.5, SOFT);
    s.addText(item.n, {
      x: x + 0.28, y: 2.95, w: 3.3, h: 0.5, fontFace: "Cambria", fontSize: 28, color: BRAND, margin: 0, isTextBox: true,
    });
    s.addText(item.h, {
      x: x + 0.28, y: 3.5, w: 3.3, h: 0.45, fontFace: "Calibri", fontSize: 20, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: x + 0.28, y: 4.05, w: 3.3, h: 1.7, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  page(s, "02");
}

// 3 Who does what
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "ONE PATH · EVERY DEPARTMENT");
  title(s, "Follow the role, not the department", 0.6, 1.05);
  body(s, "Sales, Operations, Finance, HR — the steps never change. Only the person who asks changes.", 0.6, 1.72, 12, 0.45);
  const roles = [
    { r: "Requester", t: "Any employee. Fills the visit form." },
    { r: "Line manager", t: "Approves or returns the request." },
    { r: "Reception", t: "Confirms the visit, room, and driver." },
    { r: "Marketing", t: "Prepares a gift, only if asked." },
    { r: "HR", t: "Prepares a gate pass, only if asked." },
    { r: "Guard", t: "Checks the guest in and out." },
  ];
  roles.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.6 + col * 4.15;
    const y = 2.35 + row * 2.15;
    card(s, x, y, 3.95, 1.95);
    s.addText(item.r, {
      x: x + 0.28, y: y + 0.32, w: 3.4, h: 0.4, fontFace: "Calibri", fontSize: 20, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: x + 0.28, y: y + 0.85, w: 3.4, h: 0.7, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  page(s, "03");
}

// 4 Five chapters
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "THE PROCESS");
  title(s, "Five chapters. One visit.", 0.6, 1.05);
  const steps = [
    { n: "1", h: "Raise", t: "Requester fills date, guests, and any extra need." },
    { n: "2", h: "Approve", t: "Line manager reads it and decides." },
    { n: "3", h: "Prepare", t: "Reception, Marketing, and HR do their part." },
    { n: "4", h: "Room only", t: "Optional. Reception books a room with no visitor." },
    { n: "5", h: "Gate", t: "Guard records entry, then records exit." },
  ];
  steps.forEach((item, i) => {
    const y = 1.95 + i * 0.95;
    card(s, 0.6, y, 12.1, 0.85, i % 2 ? SOFT : CARD);
    num(s, item.n, 0.85, y + 0.24);
    s.addText(item.h, {
      x: 1.45, y: y + 0.22, w: 2.4, h: 0.42, fontFace: "Calibri", fontSize: 20, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: 4.0, y: y + 0.22, w: 8.3, h: 0.42, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  page(s, "04");
}

// 5 Requester form
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "CHAPTER 1  ·  REQUESTER");
  title(s, "Raise a visit", 0.6, 1.05);
  body(s, "Menu: Request a visit. This is the same form for every department.", 0.6, 1.72, 12, 0.4);
  const fields = [
    { h: "When", t: "Visit date and arrival time." },
    { h: "Where", t: "Your department." },
    { h: "Who", t: "Guest, customer, supplier, or VIP." },
    { h: "Why", t: "A short purpose. Write it in plain words." },
  ];
  fields.forEach((item, i) => {
    const x = 0.6 + (i % 2) * 6.2;
    const y = 2.3 + Math.floor(i / 2) * 1.85;
    card(s, x, y, 5.95, 1.7);
    num(s, i + 1, x + 0.28, y + 0.28);
    s.addText(item.h, {
      x: x + 0.85, y: y + 0.28, w: 4.7, h: 0.38, fontFace: "Calibri", fontSize: 20, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: x + 0.85, y: y + 0.78, w: 4.7, h: 0.55, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  page(s, "05");
}

// 6 Guests
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "CHAPTER 1  ·  REQUESTER");
  title(s, "Number of guests", 0.6, 1.05);
  body(s, "Type how many people are coming (1 to 12). The form opens one card for each person.", 0.6, 1.72, 12, 0.45);
  card(s, 0.6, 2.35, 6.2, 4.15, PINK);
  s.addText("Required on every card", {
    x: 0.9, y: 2.6, w: 5.6, h: 0.4, fontFace: "Calibri", fontSize: 18, bold: true, color: INK, margin: 0, isTextBox: true,
  });
  ["Full name", "Mobile", "Email"].forEach((line, i) => {
    num(s, i + 1, 0.95, 3.25 + i * 0.85);
    s.addText(line, {
      x: 1.55, y: 3.25 + i * 0.85, w: 4.8, h: 0.38, fontFace: "Calibri", fontSize: 20, color: INK, margin: 0, isTextBox: true,
    });
  });
  card(s, 7.05, 2.35, 5.65, 4.15);
  s.addText("Optional", {
    x: 7.35, y: 2.6, w: 5.1, h: 0.4, fontFace: "Calibri", fontSize: 18, bold: true, color: INK, margin: 0, isTextBox: true,
  });
  s.addText("Company, job title, and nationality help Reception prepare, but the request can be sent without them.", {
    x: 7.35, y: 3.2, w: 5.05, h: 1.5, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
  });
  s.addText("One party, one request. Do not split the same visit across two forms.", {
    x: 7.35, y: 4.85, w: 5.05, h: 1.1, fontFace: "Calibri", fontSize: 16, color: INK, margin: 0, isTextBox: true,
  });
  page(s, "06");
}

// 7 Extra needs
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "CHAPTER 1  ·  REQUESTER");
  title(s, "Driver, gift, and gate pass", 0.6, 1.05);
  body(s, "Ask only for what the visit needs. Each Yes creates a task for another desk.", 0.6, 1.72, 12, 0.4);
  const needs = [
    { h: "Driver and car", who: "Reception confirms", t: "A car to collect or drop the guest." },
    { h: "Protocol gift", who: "Marketing prepares", t: "Choose Welcome gift, or another type from the list." },
    { h: "Required gate pass", who: "HR prepares", t: "HR issues the pass. Reception marks it done when it is in hand." },
  ];
  needs.forEach((item, i) => {
    const x = 0.6 + i * 4.15;
    card(s, x, 2.35, 3.95, 4.15);
    s.addText(item.h, {
      x: x + 0.28, y: 2.6, w: 3.4, h: 0.7, fontFace: "Calibri", fontSize: 22, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x + 0.28, y: 3.45, w: 3.35, h: 0.4, fill: { color: PINK }, rectRadius: 0.08,
    });
    s.addText(item.who, {
      x: x + 0.28, y: 3.45, w: 3.35, h: 0.4, align: "center", valign: "middle",
      fontFace: "Calibri", fontSize: 13, bold: true, color: BRAND, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: x + 0.28, y: 4.1, w: 3.4, h: 1.9, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  page(s, "07");
}

// 8 Submit + history
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "CHAPTER 1  ·  REQUESTER");
  title(s, "Submit, then watch History", 0.6, 1.05);
  body(s, "The request always goes to your line manager first. History is where you see what happened.", 0.6, 1.72, 12, 0.45);
  const statuses = [
    { h: "With line manager", t: "Waiting for approval. Nothing else moves yet." },
    { h: "Approved · Intake", t: "Reception has the visit and is preparing." },
    { h: "With Security", t: "The party is on today’s list at the gate." },
    { h: "Returned", t: "The manager asked for a change. Open it, fix it, send again." },
  ];
  statuses.forEach((item, i) => {
    const y = 2.3 + i * 1.05;
    card(s, 0.6, y, 12.1, 0.95, i === 0 ? PINK : CARD);
    s.addText(item.h, {
      x: 0.9, y: y + 0.26, w: 4.4, h: 0.42, fontFace: "Calibri", fontSize: 18, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: 5.5, y: y + 0.26, w: 6.9, h: 0.42, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  page(s, "08");
}

// 9 Line manager
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "CHAPTER 2  ·  LINE MANAGER");
  title(s, "Approve the visit", 0.6, 1.05);
  const left = [
    { h: "Open Approve", t: "Waiting requests from your team sit on this tab." },
    { h: "Read the guests", t: "Names, purpose, date, and any extra need." },
    { h: "Decide", t: "Approve, or return with a short comment." },
  ];
  left.forEach((item, i) => {
    const y = 1.95 + i * 1.55;
    card(s, 0.6, y, 7.3, 1.4);
    num(s, i + 1, 0.88, y + 0.48);
    s.addText(item.h, {
      x: 1.5, y: y + 0.28, w: 6.0, h: 0.38, fontFace: "Calibri", fontSize: 20, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: 1.5, y: y + 0.72, w: 6.0, h: 0.4, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  card(s, 8.15, 1.95, 4.55, 4.5, DARK);
  s.addText("Why this step exists", {
    x: 8.45, y: 2.25, w: 4.0, h: 0.7, fontFace: "Calibri", fontSize: 20, bold: true, color: WHITE, margin: 0, isTextBox: true,
  });
  s.addText("Reception cannot book a room, a driver, a gift, or a gate pass until you approve. A visit with no decision stays invisible at the gate.", {
    x: 8.45, y: 3.1, w: 4.0, h: 2.6, fontFace: "Calibri", fontSize: 16, color: "D8CCCC", margin: 0, isTextBox: true,
  });
  page(s, "09");
}

// 10 Reception
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "CHAPTER 3  ·  RECEPTION");
  title(s, "Prepare the visit", 0.6, 1.05);
  body(s, "Menu: Intake. One inbox for every approved staff request.", 0.6, 1.7, 12, 0.4);
  const rec = [
    { n: "1", h: "Open the visit", t: "Confirm the guests and the time." },
    { n: "2", h: "Choose a room", t: "Pick a free meeting room, then Confirm. Outlook books it." },
    { n: "3", h: "Driver", t: "If asked, assign the driver and mark it Done." },
    { n: "4", h: "Wait on extras", t: "Gift waits for Marketing. Gate pass waits for HR." },
    { n: "5", h: "Mark received", t: "When the gift or pass is in hand, mark it Done." },
    { n: "6", h: "Submit to Security", t: "Both guests appear on today’s list at the gate." },
  ];
  rec.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.6 + col * 4.15;
    const y = 2.25 + row * 2.2;
    card(s, x, y, 3.95, 2.05);
    num(s, item.n, x + 0.24, y + 0.28);
    s.addText(item.h, {
      x: x + 0.78, y: y + 0.28, w: 2.9, h: 0.38, fontFace: "Calibri", fontSize: 16, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: x + 0.28, y: y + 0.85, w: 3.4, h: 0.9, fontFace: "Calibri", fontSize: 15, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  page(s, "10");
}

// 11 Marketing + HR
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "CHAPTER 3  ·  MARKETING AND HR");
  title(s, "Gift and gate pass use the same pattern", 0.6, 1.05);
  [
    { x: 0.6, role: "Marketing", menu: "Gifts", items: ["Open Gift requests.", "Read the visit and the gift type.", "Approve. Status becomes Preparing.", "Reception marks Done when it arrives."] },
    { x: 6.85, role: "HR", menu: "Gate passes", items: ["Open Gate passes.", "Read the visit and the guests.", "Approve. Status becomes Preparing.", "Reception marks Done when the pass is in hand."] },
  ].forEach((col) => {
    card(s, col.x, 1.95, 5.85, 4.55);
    s.addText(col.role, {
      x: col.x + 0.35, y: 2.2, w: 5.15, h: 0.4, fontFace: "Calibri", fontSize: 22, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addText("Menu: " + col.menu, {
      x: col.x + 0.35, y: 2.65, w: 5.15, h: 0.32, fontFace: "Calibri", fontSize: 14, color: BRAND, margin: 0, isTextBox: true,
    });
    col.items.forEach((line, i) => {
      s.addText(`${i + 1}.  ${line}`, {
        x: col.x + 0.35, y: 3.2 + i * 0.7, w: 5.15, h: 0.55, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
      });
    });
  });
  page(s, "11");
}

// 12 Rooms
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "CHAPTER 4  ·  RECEPTION");
  title(s, "Book a room with no visitor", 0.6, 1.05);
  body(s, "Internal meetings do not need a visit request. Use Rooms.", 0.6, 1.72, 12, 0.4);
  const room = [
    { n: "1", t: "Open Rooms. The board shows free and busy slots." },
    { n: "2", t: "Click a free slot." },
    { n: "3", t: "Type a subject, then Book in Outlook." },
    { n: "4", t: "Add invitees on the booking card if needed." },
  ];
  room.forEach((item, i) => {
    const x = 0.6 + i * 3.15;
    card(s, x, 2.4, 3.0, 3.55);
    s.addText(item.n, {
      x: x + 0.22, y: 2.65, w: 2.5, h: 0.7, fontFace: "Cambria", fontSize: 36, color: BRAND, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: x + 0.22, y: 3.5, w: 2.55, h: 2.0, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  page(s, "12");
}

// 13 Guard
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "CHAPTER 5  ·  GUARD");
  title(s, "Check-in and check-out", 0.6, 1.05);
  const gate = [
    { h: "Today’s list", t: "Only visits submitted to Security appear here." },
    { h: "Find the party", t: "Search the visit code, or read the invitation QR." },
    { h: "Check in", t: "Open the visit. Record entry when they arrive." },
    { h: "Check out", t: "Same visit, same desk, when they leave." },
  ];
  gate.forEach((item, i) => {
    const x = 0.6 + (i % 2) * 6.2;
    const y = 1.95 + Math.floor(i / 2) * 2.3;
    card(s, x, y, 5.95, 2.1);
    num(s, i + 1, x + 0.3, y + 0.35);
    s.addText(item.h, {
      x: x + 0.9, y: y + 0.32, w: 4.7, h: 0.42, fontFace: "Calibri", fontSize: 22, bold: true, color: INK, margin: 0, isTextBox: true,
    });
    s.addText(item.t, {
      x: x + 0.9, y: y + 0.9, w: 4.7, h: 0.75, fontFace: "Calibri", fontSize: 16, color: MUTED, margin: 0, isTextBox: true,
    });
  });
  page(s, "13");
}

// 14 Quick by role
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: WHITE } });
  logo(s, 0.6, 0.32, 1.9);
  kicker(s, "KEEP THIS PAGE");
  title(s, "If you only remember one screen", 0.6, 1.05);
  const rows = [
    ["You are", "Open", "You do"],
    ["Requester", "Request a visit → History", "Ask. Then watch the status."],
    ["Line manager", "Approve", "Read, then approve or return."],
    ["Reception", "Intake · Rooms", "Prepare, or book a room only."],
    ["Marketing", "Gifts", "Start preparing the gift."],
    ["HR", "Gate passes", "Start preparing the pass."],
    ["Guard", "Security desk", "Check in, then check out."],
  ];
  rows.forEach((cols, i) => {
    const y = 1.85 + i * 0.68;
    const fill = i === 0 ? DARK : i % 2 ? SOFT : CARD;
    const color = i === 0 ? WHITE : INK;
    const muted = i === 0 ? "D8CCCC" : MUTED;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 12.1, h: 0.62, fill: { color: fill }, rectRadius: 0.08 });
    s.addText(cols[0], { x: 0.8, y, w: 2.5, h: 0.62, valign: "middle", fontFace: "Calibri", fontSize: 15, bold: true, color, margin: 0, isTextBox: true });
    s.addText(cols[1], { x: 3.4, y, w: 4.3, h: 0.62, valign: "middle", fontFace: "Calibri", fontSize: 15, color: muted, margin: 0, isTextBox: true });
    s.addText(cols[2], { x: 7.8, y, w: 4.6, h: 0.62, valign: "middle", fontFace: "Calibri", fontSize: 15, color: muted, margin: 0, isTextBox: true });
  });
  page(s, "14");
}

// 15 Close
{
  const s = pres.addSlide();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: DARK } });
  s.addShape(pres.shapes.OVAL, { x: -1.8, y: -2, w: 5, h: 5, fill: { color: "241616" } });
  logo(s, 0.7, 0.7, 2.4);
  kicker(s, "NEWEAST INTRANET · GUEST MANAGEMENT", 0.7, 2.3, "F3B4B5");
  s.addText("Ask.  Approve.  Prepare.  Welcome.", {
    x: 0.7, y: 2.7, w: 12, h: 0.9, fontFace: "Cambria", fontSize: 36, color: WHITE, margin: 0, isTextBox: true,
  });
  s.addText("Open the module from the Intranet, or go to guest.neweast.cloud.\nA short walkthrough video sits next to this file.", {
    x: 0.7, y: 3.75, w: 11, h: 0.9, fontFace: "Calibri", fontSize: 18, color: "D8CCCC", margin: 0, isTextBox: true,
  });
  ["intranet.neweast.cloud", "guest.neweast.cloud", "Walkthrough video"].forEach((label, i) => {
    const x = 0.7 + i * 4.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 5.15, w: 3.85, h: 0.7, fill: { color: i === 2 ? BRAND : "2C2222" }, rectRadius: 0.12,
    });
    s.addText(label, {
      x, y: 5.15, w: 3.85, h: 0.7, align: "center", valign: "middle",
      fontFace: "Calibri", fontSize: 16, color: WHITE, margin: 0, isTextBox: true,
    });
  });
  s.addNotes("Close by repeating: this is an Intranet module. Follow the role on screen. HR may rewrite this into policy language.");
}

pres.writeFile({ fileName: OUT }).then(() => {
  console.log("wrote", OUT);
});
