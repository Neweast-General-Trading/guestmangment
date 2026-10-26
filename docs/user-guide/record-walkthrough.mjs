import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const HQ = "/home/negt/HQ_NEWESAT_GUESTVISIT";
const DECK = "/tmp/guide-deck";
const require = createRequire(`${DECK}/package.json`);
const hqRequire = createRequire(`${HQ}/package.json`);
const puppeteer = require("puppeteer-core");
const bcrypt = hqRequire("bcryptjs");
const { PrismaClient } = hqRequire("@prisma/client");

const CHROME = "/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome";
const BASE = "http://127.0.0.1:3088";
const OUT = `${DECK}/rec3`;
const CARDS = `file://${DECK}/cards.html`;

fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(`${HQ}/docs/user-guide/video-cards.html`, `${DECK}/cards.html`);
fs.copyFileSync(`${HQ}/public/neweast-logo.png`, `${DECK}/logo.png`);

function envValue(key) {
  const text = fs.readFileSync(`${HQ}/.env`, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    if (trimmed.slice(0, index) !== key) continue;
    let value = trimmed.slice(index + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return process.env[key] || "";
}

function mintToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      jobTitle: user.jobTitle,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", envValue("AUTH_SECRET") || "dev-secret").update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

const MASK = `
(() => {
  const pairs = [
    ["Johnny Aslanian", "Sales"],
    ["Viswanath Subramanian", "Line manager"],
    ["Mais Alhamwi", "Reception"],
    ["Olga Kameniuk", "Reception"],
    ["Jesman Muruganantham", "Marketing"],
    ["Security Desk", "Guard"],
    ["Jad Sakour", "Sales"],
    ["Guru Gopalan", "Line manager"],
    ["Customer requests can go to Samir first.", "Then submit the visit to the security desk."],
    ["sr@neweast.com", "Sales"],
    ["lm@neweawt.co", "Line manager"],
    ["rec@newaest.co", "Reception"],
    ["mrk@newaet.co", "Marketing"],
    ["drv@neweast.co", "Driver"],
    ["grd@neweat.co", "Guard"],
    ["hr@newaest.co", "HR"],
    ["guest@gmail.com", ""],
  ];
  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === 3) {
      let text = node.nodeValue;
      for (const [from, to] of pairs) text = text.split(from).join(to);
      if (text !== node.nodeValue) node.nodeValue = text;
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
    if (node.id === "__cur") return;
    if (tag === "BUTTON" && /sign out/i.test(node.textContent || "")) node.style.display = "none";
    for (const child of [...node.childNodes]) walk(child);
  };
  const run = () => walk(document.body);
  setInterval(run, 400);
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
})();
`;

const KEEP = `
(() => {
  const run = () => {
    const code = window.__keepVisit;
    if (!code) return;
    const mark = (el) => {
      if (el && el.id !== "__cur") el.style.display = "none";
    };
    document.querySelectorAll("a[href^='/intake/'], a[href^='/request/'], a[href^='/visits/']").forEach((a) => {
      if (!a.textContent.includes(code)) mark(a);
    });
    document.querySelectorAll("span").forEach((span) => {
      const text = (span.textContent || "").trim();
      if (/^GV-\\d{4}-\\d{6}$/.test(text) && text !== code) {
        let node = span.parentElement;
        for (let i = 0; i < 10 && node; i += 1) {
          if (node === document.body) break;
          const box = node.className && String(node.className);
          if (node.tagName === "A" || (box && box.includes("border"))) {
            mark(node);
            break;
          }
          node = node.parentElement;
        }
      }
    });
  };
  setInterval(run, 350);
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
})();
`;

const HUD = `
(() => {
  const mount = () => {
    if (location.protocol === "file:") return;
    let b = document.getElementById("__hud");
    if (!b) {
      b = document.createElement("div");
      b.id = "__hud";
      b.innerHTML = '<div class="k">INTRANET · Guest Management</div><div class="l"><span class="r"></span><span class="dot"> · </span><span class="s"></span></div>';
      Object.assign(b.style, {
        position: "fixed", top: "10px", left: "50%", transform: "translateX(-50%)", zIndex: "2147483640",
        pointerEvents: "none", background: "rgba(30,24,24,.92)", color: "#fff",
        borderRadius: "999px", padding: "8px 18px", fontFamily: "Arial, sans-serif",
        boxShadow: "0 8px 24px rgba(0,0,0,.22)", textAlign: "center", minWidth: "420px",
      });
      const style = document.createElement("style");
      style.textContent = "#__hud .k{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#f3b4b5;font-weight:700}#__hud .l{font-size:15px;margin-top:2px;font-weight:700}#__hud .r{color:#fff}#__hud .s{color:#f3dede;font-weight:500}";
      document.documentElement.appendChild(style);
      document.documentElement.appendChild(b);
    }
    const role = window.__hudRole || "";
    const screen = window.__hudScreen || "";
    b.style.display = role ? "block" : "none";
    const r = b.querySelector(".r");
    const s = b.querySelector(".s");
    const d = b.querySelector(".dot");
    if (r) r.textContent = role;
    if (s) s.textContent = screen;
    if (d) d.style.display = screen ? "inline" : "none";
  };
  const run = () => mount();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  setInterval(run, 400);
})();
`;

const CURSOR = `
(() => {
  const mount = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#1e1818" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const x = window.__cx ?? innerWidth / 2;
    const y = window.__cy ?? innerHeight / 2;
    Object.assign(c.style, {
      position: "fixed", left: x + "px", top: y + "px", zIndex: 2147483647, pointerEvents: "none",
      transition: "left .65s cubic-bezier(.2,.7,.2,1), top .65s cubic-bezier(.2,.7,.2,1)",
      filter: "drop-shadow(0 2px 3px rgba(0,0,0,.25))",
    });
    document.documentElement.appendChild(c);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: false });
})();
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prisma = new PrismaClient();
const captions = [];
let t0 = 0;
let keepCode = "";
const cap = (text) => {
  captions.push({ at: (Date.now() - t0) / 1000, text });
  console.log(((Date.now() - t0) / 1000).toFixed(1), text);
};

const OPS = "sr@neweast.com";
const MANAGER = "lm@neweawt.co";
const RECEPTION = "rec@newaest.co";
const MARKETING = "mrk@newaet.co";
const DRIVER = "drv@neweast.co";
const GUARD = "grd@neweat.co";
const HR = "hr@newaest.co";

async function seedDemo() {
  const ops = await prisma.department.findFirst({ where: { name: { contains: "Operations" } } });
  const any = await prisma.user.findFirst({ where: { isActive: true, departmentId: { not: null } }, select: { departmentId: true } });
  const departmentId = ops?.id || any?.departmentId || null;
  const hash = bcrypt.hashSync("neweast123", 10);
  const people = [
    { email: OPS, name: "Operations", role: "EMPLOYEE", jobTitle: "Operations", accessGroup: "BUSINESS_IT", managerName: "Line manager" },
    { email: MANAGER, name: "Line manager", role: "DEPARTMENT_MANAGER", jobTitle: "Line manager", accessGroup: "BUSINESS_IT", managerName: null },
    { email: RECEPTION, name: "Reception", role: "HR_ADMIN", jobTitle: "Reception", accessGroup: "HR_ADMINISTRATION", managerName: null },
    { email: MARKETING, name: "Marketing", role: "EMPLOYEE", jobTitle: "Marketing", accessGroup: "HR_ADMINISTRATION", managerName: null },
    { email: DRIVER, name: "Driver", role: "EMPLOYEE", jobTitle: "Driver", accessGroup: "HR_ADMINISTRATION", managerName: null },
    { email: GUARD, name: "Guard", role: "SECURITY_GUARD", jobTitle: "Guard", accessGroup: null, managerName: null },
    { email: HR, name: "HR", role: "EMPLOYEE", jobTitle: "HR", accessGroup: "HR_ADMINISTRATION", managerName: null },
  ];
  for (const person of people) {
    await prisma.user.upsert({
      where: { email: person.email },
      create: { ...person, passwordHash: hash, departmentId, isActive: true },
      update: { ...person, isActive: true },
    });
  }
}

try {
  await seedDemo();

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--window-size=1680,840"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 840, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(CURSOR);
  await page.evaluateOnNewDocument(MASK);
  await page.evaluateOnNewDocument(KEEP);
  await page.evaluateOnNewDocument(HUD);
  page.setDefaultTimeout(35000);

  async function ensureCursor() {
    await page.evaluate(CURSOR);
    await page.evaluate(MASK);
    await page.evaluate(KEEP);
    await page.evaluate(HUD);
  }

  async function setHud(role, screen) {
    await page.evaluate(
      (role, screen) => {
        window.__hudRole = role;
        window.__hudScreen = screen;
      },
      role,
      screen,
    );
    await page.evaluate(HUD);
  }

  async function asUser(email, path = "/", hud = null) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`No user ${email}`);
    const token = mintToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      jobTitle: user.jobTitle,
    });
    await page.setCookie({ name: "neweast_session", value: token, url: BASE, path: "/", httpOnly: true });
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 45000 });
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 20000 }).catch(() => {});
    if (keepCode) await page.evaluate((code) => { window.__keepVisit = code; }, keepCode);
    if (hud) await setHud(hud.role, hud.screen);
    else await setHud("", "");
    await ensureCursor();
    await sleep(900);
  }

  async function moveTo(handle, { block = "center" } = {}) {
    await handle.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b, inline: "nearest" }), block);
    await sleep(500);
    await ensureCursor();
    const box = await handle.boundingBox();
    if (!box) return null;
    const x = box.x + Math.min(box.width / 2, 40);
    const y = box.y + box.height / 2;
    await page.evaluate(
      (x, y) => {
        window.__cx = x;
        window.__cy = y;
        const c = document.getElementById("__cur");
        if (c) {
          c.style.left = x + "px";
          c.style.top = y + "px";
        }
      },
      x,
      y,
    );
    await sleep(700);
    return { x, y };
  }

  async function ripple() {
    await page.evaluate(() => {
      const c = document.getElementById("__cur");
      if (!c) return;
      const r = document.createElement("div");
      Object.assign(r.style, {
        position: "fixed",
        left: parseFloat(c.style.left) - 16 + "px",
        top: parseFloat(c.style.top) - 16 + "px",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: "rgba(181,30,33,.35)",
        zIndex: 2147483646,
        pointerEvents: "none",
        transition: "transform .45s ease, opacity .45s ease",
      });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => {
        r.style.transform = "scale(1.8)";
        r.style.opacity = "0";
      });
      setTimeout(() => r.remove(), 500);
    });
  }

  async function find(selector) {
    return page.waitForSelector(selector, { visible: true });
  }

  async function byText(tag, text) {
    const handle = await page.waitForFunction(
      (tag, text) =>
        [...document.querySelectorAll(tag)].find(
          (el) => el.offsetParent !== null && el.textContent.trim().replace(/\s+/g, " ").includes(text),
        ),
      {},
      tag,
      text,
    );
    return handle.asElement();
  }

  async function click(handle) {
    await moveTo(handle);
    await ripple();
    await handle.click();
    await sleep(400);
  }

  async function point(handle, ms = 1200) {
    await moveTo(handle);
    await sleep(ms);
  }

  async function type(handle, value, { clear = false } = {}) {
    await moveTo(handle);
    await ripple();
    await handle.click({ clickCount: clear ? 3 : 1 });
    if (clear) await page.keyboard.press("Backspace");
    await handle.type(value, { delay: 38 });
    await sleep(200);
  }

  async function waitText(text, timeout = 30000) {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
    await sleep(400);
  }

  async function scene(name, ms) {
    await page.goto(`${CARDS}?scene=${name}`, { waitUntil: "load" });
    await sleep(ms);
  }

  async function narrate(text, pad = 1600) {
    cap(text);
    const spoken = text.replace(/ — /g, ". ");
    await sleep(Math.max(3800, Math.round((spoken.length / 11) * 1000) + pad));
  }

  async function pickDepartment() {
    const input = await page.waitForSelector('input[placeholder="Department"]', { visible: true });
    await moveTo(input);
    await ripple();
    await input.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await input.type("Operations", { delay: 40 });
    await sleep(500);
    const option = await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].find((el) => {
        const line = el.textContent.trim().replace(/\s+/g, " ");
        return el.offsetParent !== null && /^Operations/i.test(line);
      }),
    );
    await click(option.asElement());
  }

  async function setTime(value) {
    const input = await find('input[name="arrivalTime"]');
    await moveTo(input);
    await ripple();
    await input.evaluate((el, v) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await sleep(600);
  }

  async function smallest(text, timeout = 30000) {
    const handle = await page.waitForFunction(
      (text) => {
        const hits = [...document.querySelectorAll("main *")].filter(
          (el) => el.offsetParent !== null && el.textContent.includes(text),
        );
        hits.sort((a, b) => a.textContent.length - b.textContent.length);
        return hits[0];
      },
      { timeout },
      text,
    );
    return handle.asElement();
  }

  async function latestCode() {
    return page.evaluate(() => {
      const text = document.body.innerText;
      const matches = text.match(/GV-\d{4}-\d{6}/g) || [];
      return matches[0] || "";
    });
  }

  async function openCard(prefix, code) {
    const card = await page.waitForFunction(
      (prefix, code) => [...document.querySelectorAll(`a[href^="${prefix}"]`)].find((a) => a.textContent.includes(code)),
      { timeout: 30000 },
      prefix,
      code,
    );
    await point(card.asElement(), 1100);
    await click(card.asElement());
  }

  async function pickRoom() {
    const roomSelect = await find('select[name="meetingRoom"]');
    await moveTo(roomSelect);
    await ripple();
    const room = await roomSelect.evaluate((s) => {
      const free = [...s.options].filter((o) => o.value && !o.disabled && !/busy|past|select a room/i.test(o.text));
      const option = free.find((o) => /Berlin|Room_4/i.test(o.text)) || free[0];
      s.value = option?.value || "";
      s.dispatchEvent(new Event("change", { bubbles: true }));
      return option?.text || "";
    });
    console.log("room", room);
    await sleep(1200);
  }

  fs.rmSync(`${OUT}/frames`, { recursive: true, force: true });
  fs.mkdirSync(`${OUT}/frames`, { recursive: true });
  const frames = [];
  const cdp = await page.createCDPSession();
  cdp.on("Page.screencastFrame", async (frame) => {
    const file = `${OUT}/frames/${String(frames.length).padStart(6, "0")}.jpg`;
    fs.writeFileSync(file, Buffer.from(frame.data, "base64"));
    frames.push({ file, ts: frame.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
  });

  await page.goto(`${CARDS}?scene=intro`, { waitUntil: "load" });
  t0 = Date.now();
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 86, maxWidth: 1680, maxHeight: 840, everyNthFrame: 1 });
  await narrate("This is Guest Management, a module of the NEWEAST Intranet. Open it from the Intranet, or go to guest.neweast.cloud.");
  await scene("roles", 800);
  await narrate("Any employee, in any department, can raise a visit. Watch the role on screen. That tells you which part of the module you are in.");
  await narrate("The requester asks. The line manager approves. Reception prepares. Marketing handles a gift if asked. HR prepares a gate pass if asked. The guard welcomes the guest.");

  await scene("request", 1);
  await narrate("Chapter one. The requester raises a visit. The line manager must approve it before Reception can prepare.");

  await asUser(OPS, "/request", { role: "Requester", screen: "Request a visit" });
  await narrate("Requester — This is the visit form. Set the date, arrival time, department, and the purpose.");
  await point(await find('input[name="visitDate"]'), 500);
  await setTime("18:00");
  await pickDepartment();
  await type(await find('textarea[name="purpose"]'), "Meeting at Headquarters");
  await narrate("Requester — Set the number of guests. The form opens one card per guest. Name, mobile, and email are required.");
  const count = await find('input[name="guestCount"]');
  await moveTo(count);
  await ripple();
  await count.click({ clickCount: 3 });
  await count.type("2", { delay: 80 });
  await sleep(800);
  await waitText("Guest 2 of 2");
  await type(await find('input[name="fullName_0"]'), "Rajith Ahshlm");
  await type(await find('input[name="mobile_0"]'), "+971501110077");
  await type(await find('input[name="email_0"]'), "rajith.ahshlm@gmail.com");
  await type(await find('input[name="fullName_1"]'), "Hana Faris");
  await type(await find('input[name="mobile_1"]'), "+971501110088");
  await type(await find('input[name="email_1"]'), "hana.faris@gmail.com");
  await narrate("Requester — Ask only for what you need. Here we request a driver, a welcome gift, and a gate pass.");
  const driver = await find('select[name="driverRequired"]');
  await moveTo(driver);
  await ripple();
  await page.select('select[name="driverRequired"]', "yes");
  await sleep(400);
  await page.select('select[name="gatePassRequired"]', "yes");
  await sleep(400);
  const gift = await find('select[name="giftRequired"]');
  await moveTo(gift);
  await ripple();
  await page.select('select[name="giftRequired"]', "yes");
  await sleep(600);
  await page.select('select[name="giftType"]', "Welcome gift");
  await sleep(800);
  await narrate("Requester — Submit. The request goes to the line manager first.");
  await point(await byText("p", "for approval"), 1800);
  await click(await byText("button", "Submit request"));
  await waitText(" sent");
  const code = await latestCode();
  keepCode = code;
  await page.evaluate((value) => { window.__keepVisit = value; }, code);
  console.log("visit", code);
  await click(await byText("a", "History"));
  await setHud("Requester", "History");
  await waitText("With line manager", 20000);
  await waitText(code);
  await narrate("Requester — History shows the live status. It is with the line manager, waiting for approval.");
  await point(await smallest("With line manager"), 1800);

  await scene("approve", 1);
  await narrate("Chapter two. The line manager reviews the request and decides.");

  await asUser(MANAGER, "/request?tab=approve", { role: "Line manager", screen: "Approve" });
  await waitText(code);
  await narrate("Line manager — Open Approve. Waiting requests sit here.");
  await openCard("/request/", code);
  await setHud("Line manager", "Review request");
  await waitText("Requested by");
  await narrate("Line manager — Read the guests, add a short comment, and approve.");
  await point(await byText("h2", "Guests"), 1100);
  await type(await find('textarea[name="note"]'), "Approved. Please prepare a room, the car, the gift, and the gate pass.");
  await click(await byText("button", "Approve"));
  await waitText("Decision saved");
  await narrate("Line manager — Approved. Reception can now prepare the visit.");

  await asUser(OPS, "/request?tab=history", { role: "Requester", screen: "History" });
  await waitText(code);
  await narrate("Requester — History updates after approval. The visit is now with Administration.");
  await point(await smallest("Intake").catch(() => smallest(code)), 2000);

  await scene("prepare", 1);
  await narrate("Chapter three. Reception, Marketing, and HR prepare what was asked.");

  await asUser(RECEPTION, "/intake", { role: "Reception", screen: "Visit requests" });
  await waitText("Visit requests");
  await narrate("Reception — Staff requests arrive in one inbox. Open the visit.");
  await openCard("/intake/", code);
  await setHud("Reception", "Prepare the visit");
  await waitText("Visitors");
  await narrate("Reception — Choose a free meeting room, and assign the driver.");
  await page.evaluate(() => window.scrollBy({ top: 360, behavior: "smooth" }));
  await sleep(1200);
  await pickRoom();
  const driverName = await find('input[name="driverName"]');
  await type(driverName, "HQ Driver", { clear: true });
  await click(await byText("button", "Save"));
  await waitText("Changes saved", 20000).catch(() => sleep(1200));
  await narrate("Reception — Mark the driver done, then confirm to book the room in Outlook.");
  try {
    await type(await find('textarea[name="note"]'), "Car confirmed for the visit.");
    await click(await byText("button", "Mark driver Done"));
    await waitText("Driver confirmed", 20000).catch(() => sleep(1200));
  } catch {
    await sleep(800);
  }
  await click(await byText("button", "Confirm"));
  await waitText("Room booked in Outlook", 50000).catch(() => waitText("saved", 8000).catch(() => sleep(2000)));
  await sleep(1200);
  await narrate("Reception — A gift is waiting. Marketing prepares it before Reception marks it done.");
  try {
    await point(await smallest("Waiting for Marketing", 8000), 2200);
  } catch {
    await sleep(1600);
  }

  await asUser(MARKETING, "/gifts", { role: "Marketing", screen: "Gift requests" });
  await waitText("Gift requests");
  await narrate("Marketing — Gift requests open here. Approve so the gift moves to Preparing.");
  try {
    await point(await smallest("Rajith Ahshlm", 8000), 1400);
  } catch {
    await point(await smallest(code, 8000).catch(() => find("textarea")), 1000);
  }
  const giftNote = await find('textarea[name="note"]');
  await type(giftNote, "Preparing the welcome gift for both guests.");
  await click(await byText("button", "Approve"));
  await waitText("Preparing", 20000);
  await narrate("Marketing — The gift is preparing. Reception will mark it done when it arrives.");

  await asUser(RECEPTION, "/intake", { role: "Reception", screen: "Prepare the visit" });
  await openCard("/intake/", code);
  await setHud("Reception", "Prepare the visit");
  await waitText("Visitors");
  await narrate("Reception — The gift is ready. Mark it done.");
  try {
    await point(await smallest("Gift received", 8000), 900);
    await type(await find('textarea[name="note"]'), "Received at Reception.");
    await click(await byText("button", "Gift received"));
    await waitText("Gift status updated", 20000).catch(() => sleep(1200));
  } catch {
    await sleep(1000);
  }
  await narrate("Reception — A gate pass is waiting. HR prepares it, the same way Marketing prepares a gift.");
  try {
    await point(await smallest("Waiting for HR", 8000), 1800);
  } catch {
    await sleep(1000);
  }

  await asUser(HR, "/passes", { role: "HR", screen: "Gate passes" });
  await waitText("Gate passes");
  await narrate("HR — Gate pass requests open here. Approve so the pass moves to Preparing.");
  try {
    await point(await smallest(code, 8000), 1200);
  } catch {
    await sleep(800);
  }
  await type(await find('textarea[name="note"]'), "Preparing gate passes for both guests.");
  await click(await byText("button", "Approve"));
  await waitText("Preparing", 20000);
  await narrate("HR — The gate pass is preparing. Reception will mark it done when it is in hand.");

  await asUser(RECEPTION, "/intake", { role: "Reception", screen: "Prepare the visit" });
  await openCard("/intake/", code);
  await setHud("Reception", "Prepare the visit");
  await waitText("Visitors");
  await narrate("Reception — The gate pass is ready. Mark it done, then send the party to the guard.");
  try {
    await type(await find('textarea[name="note"]'), "Gate pass received at Reception.");
    await click(await byText("button", "Pass received"));
    await waitText("Gate pass status updated", 20000).catch(() => sleep(1200));
  } catch {
    await sleep(1000);
  }
  await narrate("Reception — Submit to Security puts both guests on today’s list at the gate.");
  await click(await byText("button", "Submit to Security"));
  await page.waitForFunction(() => location.pathname.startsWith("/security"), { timeout: 40000 });
  await setHud("Reception", "Security list");
  await sleep(1600);

  await scene("rooms", 1);
  await narrate("Chapter four. Book a room only. No visitor request is needed.");

  await asUser(RECEPTION, "/rooms", { role: "Reception", screen: "Rooms" });
  await waitText("Booking card");
  await narrate("Reception — Click a free slot, set the subject, and book in Outlook.");
  try {
    const slot = await page.waitForFunction(
      () => [...document.querySelectorAll("button")].find((b) => /Free/i.test(b.title || "") && !b.disabled),
      { timeout: 12000 },
    );
    await click(slot.asElement());
  } catch {
    await sleep(800);
  }
  const subject = await find('input[name="subject"]');
  await type(subject, "Guest meeting", { clear: true });
  await click(await byText("button", "Book in Outlook"));
  await waitText("Room booked", 40000).catch(() => waitText("Outlook", 8000).catch(() => sleep(2000)));
  await narrate("Reception — The meeting is on the rooms board. Invitees can be added on the card.");

  await scene("gate", 1);
  await narrate("Chapter five. The guard. Check the guest in, then check the guest out.");

  await asUser(GUARD, "/security", { role: "Guard", screen: "Security desk" });
  await waitText("Security desk");
  await narrate("Guard — Today’s list shows who is expected. The QR reader is for invitation codes.");
  await point(await byText("h2", "Read the visitor QR here"), 1600);
  await narrate("Guard — Open the visit to record entry.");
  await page.goto(`${BASE}/security?q=${encodeURIComponent(code)}`, { waitUntil: "networkidle0" });
  await sleep(1000);
  if (keepCode) await page.evaluate((value) => { window.__keepVisit = value; }, keepCode);
  await setHud("Guard", "Security desk");
  await ensureCursor();
  await openCard("/visits/", code);
  await setHud("Guard", "Visit record");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(800);
  await narrate("Guard — Check in. Both guests are now inside Headquarters.");
  const checkIn = await page.waitForFunction(
    () => [...document.querySelectorAll("button")].find((el) => /^\s*Check in\s*$/.test(el.textContent || "")),
    { timeout: 20000 },
  );
  await click(checkIn.asElement());
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((el) => /Check out/.test(el.textContent || "")),
    { timeout: 25000 },
  );
  await sleep(1400);
  await narrate("Guard — When the visit ends, check out. Same visit, same desk.");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(600);
  const checkOut = await page.waitForFunction(
    () => [...document.querySelectorAll("button")].find((el) => /^\s*Check out\s*$/.test(el.textContent || "")),
  );
  await click(checkOut.asElement());
  await waitText("Checked-out", 20000).catch(() => waitText("out", 8000).catch(() => sleep(1500)));
  await narrate("Guard — Done. The guest is on the record from arrival to departure.");

  await scene("outro", 1);
  await narrate("Guest Management, on the NEWEAST Intranet. Ask. Approve. Prepare. Welcome.");

  const total = (Date.now() - t0) / 1000;
  await cdp.send("Page.stopScreencast");
  await sleep(300);
  fs.writeFileSync(
    `${OUT}/captions.json`,
    JSON.stringify({ total, captions, code, frames: frames.map((f) => ({ file: f.file, at: f.ts - t0 / 1000 })) }, null, 2),
  );
  console.log("total", total.toFixed(1));
  await browser.close();
} finally {
  await prisma.$disconnect();
}
