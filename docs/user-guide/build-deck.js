const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const lu = require("react-icons/lu");

const IMG = "/home/negt/HQ_NEWESAT_GUESTVISIT/docs/user-guide/images";
const LOGO = "/home/negt/HQ_NEWESAT_GUESTVISIT/public/neweast-logo.png";
const OUT = "/home/negt/HQ_NEWESAT_GUESTVISIT/docs/user-guide/NEWEAST-Guest-Management-Guide.pptx";

const C = {
  red: "B51E21",
  redDeep: "8A1719",
  blush: "FBEFEF",
  ink: "221C1C",
  night: "1E1818",
  muted: "6B6262",
  faint: "A39898",
  line: "EADFDF",
  white: "FFFFFF",
  sage: "2F7D6D",
  sageTint: "E8F3EE",
  sand: "F6EEDF",
  sky: "EAF0F8",
};
const HEAD = "Cambria";
const BODY = "Calibri";
const W = 13.333;

const SIZES = {
  "sign-in": [2200, 1440],
  intake: [1360, 900],
};
const ratio = (name) => {
  const [w, h] = SIZES[name] || [1360, 860];
  return h / w;
};

async function icon(Icon, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Icon, { color: `#${color}`, size: String(size) }),
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "NEWEAST Guest Management · User guide";
  pres.company = "NEWEAST Headquarters";

  const I = {};
  const names = {
    user: lu.LuUser,
    users: lu.LuUsers,
    check: lu.LuBadgeCheck,
    inbox: lu.LuInbox,
    door: lu.LuDoorOpen,
    chart: lu.LuChartColumn,
    shield: lu.LuShieldCheck,
    mail: lu.LuMail,
    calendar: lu.LuCalendarDays,
    send: lu.LuSend,
    qr: lu.LuScanLine,
    walk: lu.LuFootprints,
    bell: lu.LuBell,
    key: lu.LuKeyRound,
    x: lu.LuCircleX,
    message: lu.LuMessageSquare,
    arrow: lu.LuArrowRight,
    list: lu.LuListChecks,
    building: lu.LuBuilding2,
    link: lu.LuLink,
    flag: lu.LuFlag,
    eye: lu.LuEye,
  };
  for (const [key, Icon] of Object.entries(names)) {
    I[key] = await icon(Icon, C.white);
    I[`${key}Red`] = await icon(Icon, C.red);
  }

  function badge(slide, key, x, y, d = 0.62, fill = C.red) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
    const p = d * 0.26;
    slide.addImage({ data: I[key], x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p });
  }

  function softBadge(slide, key, x, y, d = 0.5) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.blush }, line: { color: C.blush } });
    const p = d * 0.25;
    slide.addImage({ data: I[`${key}Red`], x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p });
  }

  function text(slide, value, opts) {
    slide.addText(value, { isTextBox: true, margin: 0, fontFace: BODY, color: C.ink, valign: "top", ...opts });
  }

  function header(slide, kicker, title, n) {
    slide.background = { color: C.white };
    text(slide, kicker.toUpperCase(), { x: 0.6, y: 0.42, w: 8, h: 0.3, fontSize: 11, bold: true, color: C.red, charSpacing: 3 });
    text(slide, title, { x: 0.6, y: 0.72, w: 11.2, h: 0.75, fontFace: HEAD, fontSize: 34, color: C.ink });
    slide.addImage({ path: LOGO, x: W - 0.6 - 1.45, y: 0.46, w: 1.45, h: 1.45 * (126 / 720) });
    text(slide, String(n).padStart(2, "0"), { x: W - 1.2, y: 7.0, w: 0.6, h: 0.25, fontSize: 10, color: C.faint, align: "right" });
  }

  function shot(slide, name, x, y, w, caption) {
    const h = w * ratio(name);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x - 0.08,
      y: y - 0.08,
      w: w + 0.16,
      h: h + 0.16,
      rectRadius: 0.12,
      fill: { color: C.white },
      line: { color: C.line, width: 0.75 },
      shadow: { type: "outer", color: "5A3A3A", opacity: 0.14, blur: 14, offset: 4, angle: 90 },
    });
    slide.addImage({ path: path.join(IMG, `${name}.png`), x, y, w, h });
    if (caption) text(slide, caption, { x, y: y + h + 0.16, w, h: 0.28, fontSize: 11, color: C.faint, italic: true });
    return h;
  }

  function steps(slide, items, x, y, w, gap = 0.62) {
    items.forEach((item, i) => {
      const top = y + i * gap;
      slide.addShape(pres.shapes.OVAL, { x, y: top, w: 0.36, h: 0.36, fill: { color: C.blush }, line: { color: C.blush } });
      text(slide, String(i + 1), { x, y: top + 0.055, w: 0.36, h: 0.26, fontSize: 12, bold: true, color: C.red, align: "center" });
      const [head, sub] = Array.isArray(item) ? item : [item, ""];
      text(slide, head, { x: x + 0.52, y: top + 0.02, w: w - 0.52, h: 0.3, fontSize: 15, bold: true });
      if (sub) text(slide, sub, { x: x + 0.52, y: top + 0.31, w: w - 0.52, h: 0.28, fontSize: 12.5, color: C.muted });
    });
  }

  function card(slide, x, y, w, h, fill = C.white, line = C.line) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x,
      y,
      w,
      h,
      rectRadius: 0.14,
      fill: { color: fill },
      line: { color: line, width: 0.75 },
    });
  }

  function roleSheet(slide, { who, home, can, cannot }, x, y, w) {
    card(slide, x, y, w, 0.95, C.blush, C.blush);
    text(slide, "WHO", { x: x + 0.25, y: y + 0.17, w: 1.1, h: 0.22, fontSize: 9.5, bold: true, color: C.red, charSpacing: 2 });
    text(slide, who, { x: x + 0.25, y: y + 0.42, w: w / 2 - 0.35, h: 0.4, fontSize: 13, bold: true });
    text(slide, "HOME PAGE", { x: x + w / 2, y: y + 0.17, w: 2, h: 0.22, fontSize: 9.5, bold: true, color: C.red, charSpacing: 2 });
    text(slide, home, { x: x + w / 2, y: y + 0.42, w: w / 2 - 0.25, h: 0.4, fontSize: 13, bold: true });

    text(slide, "CAN", { x, y: y + 1.2, w: 2, h: 0.22, fontSize: 9.5, bold: true, color: C.sage, charSpacing: 2 });
    text(
      slide,
      can.map((line, i) => ({ text: line, options: { bullet: { indent: 14 }, breakLine: i < can.length - 1, paraSpaceAfter: 6 } })),
      { x, y: y + 1.48, w, h: can.length * 0.37, fontSize: 13, color: C.ink },
    );
    if (cannot?.length) {
      const top = y + 1.62 + can.length * 0.37;
      text(slide, "DOES NOT", { x, y: top, w: 2, h: 0.22, fontSize: 9.5, bold: true, color: C.faint, charSpacing: 2 });
      text(
        slide,
        cannot.map((line, i) => ({ text: line, options: { bullet: { indent: 14 }, breakLine: i < cannot.length - 1, paraSpaceAfter: 4 } })),
        { x, y: top + 0.28, w, h: cannot.length * 0.34, fontSize: 12.5, color: C.muted },
      );
    }
  }

  let n = 0;

  // 1. Cover
  {
    const s = pres.addSlide();
    s.background = { color: C.night };
    s.addShape(pres.shapes.OVAL, { x: 8.6, y: -1.6, w: 7.2, h: 7.2, fill: { color: C.red, transparency: 82 }, line: { color: C.night, transparency: 100 } });
    s.addShape(pres.shapes.OVAL, { x: 10.3, y: 3.6, w: 4.4, h: 4.4, fill: { color: C.red, transparency: 90 }, line: { color: C.night, transparency: 100 } });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 0.75, w: 2.6, h: 0.72, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.white } });
    s.addImage({ path: LOGO, x: 0.98, y: 0.88, w: 2.24, h: 2.24 * (126 / 720) });
    text(s, "HEADQUARTERS", { x: 0.8, y: 2.55, w: 6, h: 0.3, fontSize: 12, bold: true, color: "E8898A", charSpacing: 4 });
    text(s, "Guest Management", { x: 0.8, y: 2.9, w: 9, h: 1.1, fontFace: HEAD, fontSize: 54, color: C.white });
    text(s, "User guide · five roles, one calm flow", { x: 0.8, y: 4.05, w: 9, h: 0.5, fontSize: 20, color: "D9CFCF" });
    text(s, "guest.neweast.cloud", { x: 0.8, y: 6.4, w: 5, h: 0.35, fontSize: 14, color: "B7ABAB" });
    n += 1;
  }

  // 2. The flow
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "How a visit moves", "From request to the gate", n);
    const flow = [
      ["user", "Employee", "Asks for the visit"],
      ["check", "Line manager", "Approves or declines"],
      ["inbox", "Reception", "Room, details, confirm"],
      ["shield", "Guard", "Checks in and out"],
      ["chart", "Reporting", "Sees it all, decides escalations"],
    ];
    const cw = 2.18;
    const gap = 0.3;
    const x0 = (W - (flow.length * cw + (flow.length - 1) * gap)) / 2;
    flow.forEach(([key, title, sub], i) => {
      const x = x0 + i * (cw + gap);
      card(s, x, 2.15, cw, 2.55, i === 0 ? C.blush : C.white);
      badge(s, key, x + cw / 2 - 0.36, 2.45, 0.72);
      text(s, title, { x: x + 0.15, y: 3.38, w: cw - 0.3, h: 0.4, fontSize: 17, bold: true, align: "center" });
      text(s, sub, { x: x + 0.15, y: 3.8, w: cw - 0.3, h: 0.7, fontSize: 12.5, color: C.muted, align: "center" });
      if (i < flow.length - 1) s.addImage({ data: I.arrowRed, x: x + cw + 0.03, y: 3.3, w: 0.24, h: 0.24 });
    });
    card(s, 0.6, 5.2, W - 1.2, 1.25, C.sageTint, C.sageTint);
    softBadge(s, "mail", 0.9, 5.57, 0.52);
    text(s, "Guests can also email guest@neweast.co", { x: 1.62, y: 5.48, w: 10.5, h: 0.35, fontSize: 16, bold: true, color: C.sage });
    text(s, "Those requests land in Reception’s queue next to staff requests and follow the same path from there.", {
      x: 1.62,
      y: 5.86,
      w: 10.8,
      h: 0.4,
      fontSize: 13.5,
      color: "355A50",
    });
  }

  // 3. Roles at a glance
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Roles", "Five desks. You see only yours.", n);
    const roles = [
      ["user", "Employee", "Visit request", "Sends requests for guests and follows them."],
      ["check", "Manager", "Approvals", "Reviews team requests and decides."],
      ["inbox", "Reception", "Visit requests · Meeting rooms", "Prepares each visit and its room."],
      ["chart", "Reporting and control", "Reports · Visits · Escalations", "Reads the numbers, decides escalations."],
      ["shield", "Guard", "Desk · Inside now · Walk-in", "Runs the gate and the headcount."],
    ];
    const cw = 5.95;
    const rh = 1.12;
    const gapY = 0.2;
    const place = (i) => {
      const col = i < 3 ? 0 : 1;
      const row = i < 3 ? i : i - 3;
      return { x: 0.6 + col * (cw + 0.23), y: 1.9 + row * (rh + gapY) };
    };
    const roleCard = (i, key, name, pages, what, dark) => {
      const { x, y } = place(i);
      card(s, x, y, cw, rh, dark ? C.night : C.white, dark ? C.night : C.line);
      badge(s, key, x + 0.25, y + 0.25, 0.62);
      text(s, name, { x: x + 1.1, y: y + 0.14, w: cw - 1.3, h: 0.32, fontSize: 16, bold: true, color: dark ? C.white : C.ink });
      text(s, pages, { x: x + 1.1, y: y + 0.47, w: cw - 1.3, h: 0.25, fontSize: 11, bold: true, color: dark ? "E8898A" : C.red });
      text(s, what, { x: x + 1.1, y: y + 0.75, w: cw - 1.3, h: 0.28, fontSize: 12.5, color: dark ? "D9CFCF" : C.muted });
    };
    roles.forEach(([key, name, pages, what], i) => roleCard(i, key, name, pages, what, false));
    roleCard(5, "key", "Administration", "Reception + Reporting and control", "Both desks together, for the system owner.", true);
    text(s, "The sidebar shows only the pages for your role. Sign in, and your home page opens by itself.", {
      x: 0.6,
      y: 6.3,
      w: 12,
      h: 0.35,
      fontSize: 13,
      color: C.muted,
      italic: true,
    });
  }

  // 4. Sign in
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Start", "Sign in", n);
    steps(
      s,
      [
        ["Open guest.neweast.cloud", "Any browser, desktop or phone."],
        ["Use your NEWEAST email", "The same address you use at work."],
        ["Enter your password", "Then press Sign in."],
        ["Your desk opens", "The system knows your role."],
      ],
      0.6,
      2.0,
      4.6,
      0.82,
    );
    shot(s, "sign-in", 5.85, 1.75, 6.85);
  }

  // 5. Employee role
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Role 1 · Employee", "Ask for a visit", n);
    roleSheet(
      s,
      {
        who: "Any staff member hosting a guest",
        home: "Visit request",
        can: [
          "Set date, time, department, guest type",
          "Write the purpose, ask for a driver",
          "Add one or more guests",
          "Follow and open every request you sent",
          "Get email and Teams on the decision",
        ],
        cannot: ["Book rooms or see other people’s visits", "Check guests in at the gate"],
      },
      0.6,
      1.8,
      4.95,
    );
    shot(s, "employee-request", 5.95, 1.8, 6.75, "The request form. The line under the guests names your approver.");
  }

  // 6. Employee after submit
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Role 1 · Employee", "After you press Submit", n);
    shot(s, "request-detail", 0.6, 1.8, 6.75, "An opened request: when, party, next step, purpose, guests.");
    const x = 7.85;
    const w = W - 0.6 - x;
    const states = [
      ["With line manager", "Your manager reviews it first.", C.sand],
      ["Intake", "Reception is preparing it.", C.sky],
      ["Expected", "Confirmed. The guard is expecting them.", C.sageTint],
      ["Rejected", "Declined, with the reason if one was given.", C.blush],
    ];
    text(s, "WHAT THE STATUS MEANS", { x, y: 1.8, w, h: 0.25, fontSize: 10, bold: true, color: C.red, charSpacing: 2 });
    states.forEach(([name, sub, fill], i) => {
      const y = 2.18 + i * 0.83;
      card(s, x, y, w, 0.7, fill, fill);
      text(s, name, { x: x + 0.22, y: y + 0.1, w: w - 0.4, h: 0.28, fontSize: 14.5, bold: true });
      text(s, sub, { x: x + 0.22, y: y + 0.38, w: w - 0.4, h: 0.26, fontSize: 12, color: C.muted });
    });
    softBadge(s, "bell", x, 5.62, 0.5);
    text(s, "No manager on file? The request goes straight to Reception.", { x: x + 0.65, y: 5.64, w: w - 0.65, h: 0.5, fontSize: 12.5, color: C.muted });
  }

  // 7. Manager role
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Role 2 · Manager", "Approve your team", n);
    roleSheet(
      s,
      {
        who: "Department and line managers",
        home: "Approvals",
        can: [
          "See every team request waiting for you",
          "Open it: date, purpose, driver, each guest",
          "Add an optional comment",
          "Approve to send it to Reception, or Decline",
          "Send your own request with the same form",
        ],
        cannot: ["Choose rooms or confirm visits", "Approve requests of other teams"],
      },
      0.6,
      1.8,
      4.95,
    );
    const x = 6.05;
    const w = W - 0.6 - x;
    text(s, "REVIEWING A REQUEST", { x, y: 1.8, w, h: 0.25, fontSize: 10, bold: true, color: C.red, charSpacing: 2 });
    steps(
      s,
      [
        ["Open the card", "Under Waiting for your approval, at the top of Approvals."],
        ["Read the details", "When, party, purpose, and the guest list."],
        ["Write a comment if needed", "It is saved with the request."],
        ["Approve or Decline", "Approve sends it to Reception."],
      ],
      x,
      2.2,
      w,
      0.8,
    );
    card(s, x, 5.55, w, 0.85, C.sageTint, C.sageTint);
    softBadge(s, "message", x + 0.2, 5.72, 0.5);
    text(s, "The employee is told either way, by email and Teams, with your comment.", {
      x: x + 0.85,
      y: 5.77,
      w: w - 1.05,
      h: 0.45,
      fontSize: 13,
      color: C.sage,
      bold: true,
    });
  }

  // 8. Reception role
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Role 3 · Reception", "Prepare every visit", n);
    roleSheet(
      s,
      {
        who: "Reception, HR and Administration",
        home: "Visit requests",
        can: [
          "Work staff requests and guest@ emails",
          "Correct details, choose the meeting room",
          "Confirm: book in Outlook, tell the employee",
          "Submit the visit to Security",
          "Escalate a customer request for a decision",
        ],
        cannot: ["Approve instead of the line manager"],
      },
      0.6,
      1.8,
      4.95,
    );
    shot(s, "intake", 5.95, 1.8, 6.75, "Visit requests: staff and email, newest first. Room replies on the side.");
  }

  // 9. Reception buttons
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Role 3 · Reception", "Working a request", n);
    shot(s, "intake-detail", 0.6, 1.8, 6.75, "Open a card. Fix what is missing, pick the room.");
    const x = 7.85;
    const w = W - 0.6 - x;
    const actions = [
      ["list", "Save", "Keeps your edits. Nothing is sent."],
      ["calendar", "Confirm", "Books the Outlook room, tells the employee."],
      ["send", "Submit to Security", "The guard now expects the visit."],
      ["flag", "Escalation", "A customer request goes up for a decision."],
    ];
    actions.forEach(([key, name, sub], i) => {
      const y = 1.8 + i * 0.95;
      card(s, x, y, w, 0.8);
      softBadge(s, key, x + 0.17, y + 0.15, 0.5);
      text(s, name, { x: x + 0.82, y: y + 0.12, w: w - 1, h: 0.28, fontSize: 14.5, bold: true });
      text(s, sub, { x: x + 0.82, y: y + 0.42, w: w - 1, h: 0.3, fontSize: 12, color: C.muted });
    });
    card(s, x, 5.7, w, 0.78, C.sand, C.sand);
    text(s, "When the room accepts, guest@neweast.co replies to the requester and the card shows Reply done.", {
      x: x + 0.22,
      y: 5.8,
      w: w - 0.4,
      h: 0.6,
      fontSize: 12,
      color: "5A4A2E",
    });
  }

  // 10. Meeting rooms
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Role 3 · Reception", "Meeting rooms", n);
    shot(s, "rooms", 0.6, 1.8, 7.3);
    const x = 8.4;
    const w = W - 0.6 - x;
    const legend = [
      ["8FCB9F", "Free", "Click it, the booking card fills in."],
      ["D9766C", "Busy", "Hover one of ours to see the visit."],
      ["D6D1D0", "Past", "Earlier times cannot be booked."],
    ];
    text(s, "READING THE BOARD", { x, y: 1.8, w, h: 0.25, fontSize: 10, bold: true, color: C.red, charSpacing: 2 });
    legend.forEach(([color, name, sub], i) => {
      const y = 2.2 + i * 0.85;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y + 0.05, w: 0.5, h: 0.5, rectRadius: 0.08, fill: { color }, line: { color } });
      text(s, name, { x: x + 0.7, y: y + 0.02, w: w - 0.7, h: 0.28, fontSize: 14.5, bold: true });
      text(s, sub, { x: x + 0.7, y: y + 0.3, w: w - 0.7, h: 0.28, fontSize: 12, color: C.muted });
    });
    text(s, "TO BOOK", { x, y: 4.85, w, h: 0.25, fontSize: 10, bold: true, color: C.red, charSpacing: 2 });
    text(
      s,
      [
        { text: "Pick a free slot", options: { bullet: { type: "number" }, breakLine: true, paraSpaceAfter: 4 } },
        { text: "Check room, start, end", options: { bullet: { type: "number" }, breakLine: true, paraSpaceAfter: 4 } },
        { text: "Press Book in Outlook", options: { bullet: { type: "number" } } },
      ],
      { x, y: 5.15, w, h: 1.1, fontSize: 13.5 },
    );
  }

  // 11. Reporting and control
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Role 4 · Reporting and control", "See the whole picture", n);
    roleSheet(
      s,
      {
        who: "Management, e.g. Samir Ibrahim",
        home: "Reports",
        can: [
          "Read visit mix, busy hours, departments",
          "Export the numbers to CSV",
          "Search every visit in Visits",
          "Approve or reject customer escalations",
          "Add notes that go back to Reception",
        ],
        cannot: ["Edit the visit or book rooms"],
      },
      0.6,
      1.8,
      4.95,
    );
    shot(s, "reports", 5.95, 1.8, 6.75, "Reports. Visits and Escalations sit in the same sidebar group.");
  }

  // 12. Guard desk
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Role 5 · Guard", "The gate", n);
    roleSheet(
      s,
      {
        who: "Security desk and supervisors",
        home: "Desk",
        can: [
          "Scan the invitation QR to check in or out",
          "Paste the invitation link if the camera is off",
          "Follow today’s queues at the gate",
          "See who is inside now, for a headcount",
          "Register a walk-in visitor",
        ],
        cannot: ["Change rooms or the visit request"],
      },
      0.6,
      1.8,
      4.95,
    );
    shot(s, "security", 5.95, 1.8, 6.75, "Choose Check-in or Check-out first, then scan.");
  }

  // 13. Walk-in
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Role 5 · Guard", "Walk-in and Inside now", n);
    shot(s, "walk-in", 0.6, 1.8, 6.75, "Walk-in: host, purpose, visitor.");
    const x = 7.85;
    const w = W - 0.6 - x;
    card(s, x, 1.8, w, 2.05);
    badge(s, "walk", x + 0.25, 2.05, 0.6);
    text(s, "Walk-in", { x: x + 1.05, y: 2.18, w: w - 1.3, h: 0.35, fontSize: 17, bold: true });
    text(s, "Someone arrives without an appointment. Register them, name the host, and wait for approval before check-in.", {
      x: x + 0.25,
      y: 2.85,
      w: w - 0.5,
      h: 0.95,
      fontSize: 13,
      color: C.muted,
    });
    card(s, x, 4.1, w, 2.05);
    badge(s, "building", x + 0.25, 4.35, 0.6);
    text(s, "Inside now", { x: x + 1.05, y: 4.48, w: w - 1.3, h: 0.35, fontSize: 17, bold: true });
    text(s, "Everyone still in the building, with their host. Use it for a headcount or an evacuation.", {
      x: x + 0.25,
      y: 5.15,
      w: w - 0.5,
      h: 0.95,
      fontSize: 13,
      color: C.muted,
    });
  }

  // 14. Who gets told
  {
    const s = pres.addSlide();
    n += 1;
    header(s, "Notifications", "Who hears what", n);
    const rows = [
      ["Employee sends a request", "Line manager", "Email · Teams"],
      ["Manager approves", "Employee", "It is now with Reception, with the comment"],
      ["Manager declines", "Employee", "Email · Teams, with the comment"],
      ["Reception confirms the visit", "Employee", "Email · Teams: date, time, room, guests"],
      ["Room accepts the booking", "Sender of an email request", "Reply from guest@neweast.co"],
      ["Reception submits to Security", "Guards", "Appears on the Desk"],
      ["Customer request escalated", "Samir Ibrahim", "Email · Teams"],
    ];
    const headRow = [
      { text: "When", options: { bold: true, color: C.white, fill: { color: C.red } } },
      { text: "Who", options: { bold: true, color: C.white, fill: { color: C.red } } },
      { text: "How", options: { bold: true, color: C.white, fill: { color: C.red } } },
    ];
    const body = rows.map((r, i) =>
      r.map((cell, j) => ({
        text: cell,
        options: { fill: { color: i % 2 ? C.white : "FDF7F7" }, bold: j === 0, color: j === 2 ? C.muted : C.ink },
      })),
    );
    s.addTable([headRow, ...body], {
      x: 0.6,
      y: 1.85,
      w: W - 1.2,
      colW: [4.2, 3.6, W - 1.2 - 7.8],
      fontFace: BODY,
      fontSize: 13.5,
      rowH: 0.54,
      margin: [0.08, 0.2, 0.08, 0.2],
      valign: "middle",
      border: { type: "solid", color: C.line, pt: 0.75 },
    });
  }

  // 15. Closing
  {
    const s = pres.addSlide();
    s.background = { color: C.night };
    s.addShape(pres.shapes.OVAL, { x: -2.2, y: 3.4, w: 6.5, h: 6.5, fill: { color: C.red, transparency: 85 }, line: { color: C.night, transparency: 100 } });
    text(s, "IN ONE LINE", { x: 0.8, y: 1.3, w: 6, h: 0.3, fontSize: 12, bold: true, color: "E8898A", charSpacing: 4 });
    text(s, "Ask. Approve. Prepare. Welcome.", { x: 0.8, y: 1.7, w: 11.5, h: 1.0, fontFace: HEAD, fontSize: 46, color: C.white });
    const bits = [
      ["user", "Employee asks"],
      ["check", "Manager approves"],
      ["inbox", "Reception prepares"],
      ["shield", "Guard welcomes"],
    ];
    bits.forEach(([key, label], i) => {
      const x = 0.8 + i * 3.0;
      badge(s, key, x, 3.35, 0.62);
      text(s, label, { x: x + 0.8, y: 3.5, w: 2.1, h: 0.35, fontSize: 15, color: "E9E1E1" });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 5.0, w: 5.2, h: 0.85, rectRadius: 0.14, fill: { color: "2C2323" }, line: { color: "3A2F2F" } });
    s.addImage({ data: I.link, x: 1.05, y: 5.24, w: 0.36, h: 0.36 });
    text(s, "guest.neweast.cloud", { x: 1.6, y: 5.22, w: 4.2, h: 0.4, fontSize: 18, bold: true, color: C.white });
    text(s, "Questions? Ask Reception.", { x: 6.4, y: 5.25, w: 5, h: 0.4, fontSize: 15, color: "B7ABAB" });
  }

  await pres.writeFile({ fileName: OUT });
  console.log(OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
