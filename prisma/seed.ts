import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, subDays } from "date-fns";
import { randomBytes } from "crypto";
import { upsertServiceCatalog } from "../src/lib/service-master";

const DEFAULT_RULES = [
  {
    visitType: "CUSTOMER",
    vip: false,
    steps: [
      { name: "Line Manager", role: "DEPARTMENT_MANAGER", preset: "HOST_MANAGER" },
      { name: "Samir Ibrahim", role: "MANAGEMENT", preset: "SAMIR" },
    ],
  },
  { visitType: "EMPLOYEE_VISIT", vip: false, steps: [{ name: "Mais Alhamwi", role: "HR_ADMIN", preset: "MAIS" }] },
];

function makeQrToken() {
  return randomBytes(16).toString("hex");
}

const prisma = new PrismaClient();
const TODAY = startOfDay(new Date());

function at(day: Date, hour: number, minute = 0) {
  return setMinutes(setHours(day, hour), minute);
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.visitServiceUpdate.deleteMany();
  await prisma.visitServiceTask.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.visitVisitor.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.visitor.deleteMany();
  await prisma.guestServiceOwner.deleteMany();
  await prisma.guestService.deleteMany();
  await prisma.approvalRule.deleteMany();
  await prisma.lookup.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  const passwordHash = await bcrypt.hash("neweast123", 10);

  const departments = await Promise.all(
    [
      ["Executive Office", "EXEC"],
      ["Sales", "SALES"],
      ["Operations", "OPS"],
      ["HR & Administration", "HR"],
      ["Finance", "FIN"],
      ["Information Technology", "IT"],
      ["Marketing", "MKT"],
      ["Procurement", "PROC"],
      ["Legal", "LEGAL"],
    ].map(([name, code]) => prisma.department.create({ data: { name, code } })),
  );

  const dept = Object.fromEntries(departments.map((item) => [item.code, item]));

  const users = await Promise.all(
    [
      ["adminsatror@neweast.co", "System Administrator", "SYSTEM_ADMIN", "IT", "System Administrator"],
      ["security@neweast.co", "Security Desk", "SECURITY_GUARD", null, "Security Officer"],
      ["olga@neweast.co", "Olga Kameniuk", "HR_ADMIN", "HR", "HR Manager"],
      ["mais.alhamwi@neweast.com", "Mais Alhamwi", "HR_ADMIN", "HR", "Manager"],
      ["jesman@neweast.co", "Jesman Muruganantham", "DEPARTMENT_MANAGER", "MKT", "Marketing Executive"],
      ["sakour@neweast.co", "Sakour Jad", "EMPLOYEE", "IT", "Developer"],
      ["hana.ops@neweast.com", "Hana Farid", "DEPARTMENT_MANAGER", "OPS", "Operations Manager"],
      ["yousef.fin@neweast.com", "Yousef Haddad", "EMPLOYEE", "FIN", "Finance Analyst"],
      ["navami.balachandran@neweast.co", "Navami Balachandran", "EMPLOYEE", "HR", "HR Executive"],
      ["karim.guard@neweast.com", "Karim Saleh", "SECURITY_GUARD", null, "Security Officer"],
      ["jad.guard@neweast.com", "Jad Khoury", "SECURITY_GUARD", null, "Security Officer"],
      ["rami.supervisor@neweast.com", "Rami Fadel", "SECURITY_SUPERVISOR", null, "Security Supervisor"],
      ["samira.exec@neweast.com", "Samira Khoury", "MANAGEMENT", "EXEC", "Deputy General Manager"],
      ["viswanath@neweast.co", "Viswanath Subramanian", "DEPARTMENT_MANAGER", "IT", "IT/IS Manager"],
      ["vinod.kumar@neweast.co", "Vinod Kumar", "EMPLOYEE", "IT", "IT/IS Manager"],
      ["guru@neweast.co", "Guru Gopalan", "EMPLOYEE", "IT", "Information System Manager"],
      ["jaideep@neweast.co", "Jaideep Amuloju", "EMPLOYEE", "IT", "IT/IS Manager"],
      ["ashwin@neweast.co", "Ashwin Shetty", "EMPLOYEE", "IT", "IT Associate"],
      ["ali.aji@neweast.co", "Ali Aji", "EMPLOYEE", "IT", "IT Associate"],
      ["jithin@neweast.co", "Jithin Shammy", "EMPLOYEE", "IT", "Junior IT Executive"],
      ["rahul@neweast.co", "Rahul VR", "EMPLOYEE", "IT", "Junior IT Executive"],
      ["rami@neweast.co", "Rami Hamadeh", "EMPLOYEE", "IT", "Developer"],
      ["tahir@neweast.co", "Tahir Irshad", "EMPLOYEE", "IT", "Developer"],
      ["nimesh@neweast.co", "Nimesh Kavinda", "EMPLOYEE", "IT", "Junior IT Executive"],
      ["varghese@neweast.co", "Varghese Sujith", "EMPLOYEE", "IT", "IT Associate"],
      ["arasu.raj@neweast.co", "Mutharasan Rajalingam", "EMPLOYEE", "IT", "Developer"],
      ["soumya.antony@neweast.co", "Soumya Antony", "EMPLOYEE", "IT", "Purchase Executive"],
      ["khaled@neweast.co", "Khaled El Ashmawy", "EMPLOYEE", "HR", "HR Manager"],
      ["mamta@neweast.co", "Mamta Sharma", "EMPLOYEE", "HR", "HR Manager"],
      ["sumit.malhotra@neweast.co", "Sumit Malhotra", "EMPLOYEE", "HR", "HR Manager"],
      ["rita@neweast.co", "Rita Chettiar", "EMPLOYEE", "HR", "HR Executive"],
      ["roann@neweast.co", "Ro Ann Gonzales", "EMPLOYEE", "HR", "HR Executive"],
      ["shahd@neweast.co", "Shahd Amin", "EMPLOYEE", "HR", "HR Executive"],
      ["sona.jacob@neweast.co", "Sona Jacob", "EMPLOYEE", "HR", "Junior HR Executive"],
      ["sree@neweast.co", "Sreelakshmy Mohandas", "EMPLOYEE", "HR", "HR Assistant"],
      ["thusitha@neweast.co", "Thusitha Pradeep", "EMPLOYEE", "HR", "HR Executive"],
      ["aslam@neweast.co", "Aslam Kaichi", "EMPLOYEE", "HR", "PRO"],
      ["safnas@neweast.co", "Mohammad Safnas", "EMPLOYEE", "MKT", "Graphic Designer"],
      ["monica@neweast.co", "Monica Chikhani", "EMPLOYEE", "MKT", "Marketing Executive"],
      ["sawsan@neweast.co", "Sawsan Atia", "EMPLOYEE", "MKT", "Marketing Executive"],
    ].map(([email, name, role, code, jobTitle]) =>
      prisma.user.create({
        data: {
          email: email as string,
          name: name as string,
          role: role as string,
          jobTitle: jobTitle as string,
          passwordHash,
          departmentId: code ? dept[code].id : null,
          phone: "+961 1 000 000",
        },
      }),
    ),
  );

  const user = Object.fromEntries(users.map((item) => [item.email, item]));

  await prisma.department.update({
    where: { id: dept.MKT.id },
    data: { managerId: user["jesman@neweast.co"].id },
  });
  await prisma.department.update({
    where: { id: dept.OPS.id },
    data: { managerId: user["hana.ops@neweast.com"].id },
  });
  await prisma.department.update({
    where: { id: dept.IT.id },
    data: { managerId: user["viswanath@neweast.co"].id },
  });
  await prisma.department.update({
    where: { id: dept.HR.id },
    data: { managerId: user["olga@neweast.co"].id },
  });

  await prisma.systemSetting.createMany({
    data: [
      { key: "appointment_window_minutes", value: "120" },
      { key: "data_retention_days", value: "365" },
      { key: "invite_instructions", value: "Please arrive 10 minutes early and present this invitation at the Main Gate." },
      { key: "parking_instructions", value: "Visitor parking is in Basement B1. Present this invitation to the parking attendant." },
      { key: "location_instructions", value: "NEWEAST Headquarters, Main Entrance. Security will issue a visitor badge after verification." },
      { key: "badge_prefix", value: "VB" },
      { key: "visit_seq_2026", value: "0" },
      { key: "badge_seq", value: "1040" },
    ],
  });

  await prisma.lookup.createMany({
    data: [
      ...["Lobby / Reception", "Executive Floor", "Sales Floor", "Operations Wing", "HR Suite"].map((label, i) => ({
        kind: "location",
        code: `LOC_${i + 1}`,
        label,
      })),
      ...["Boardroom A", "Meeting Room 1", "Interview Room 1", "Training Hall"].map((label, i) => ({
        kind: "meetingRoom",
        code: `RM_${i + 1}`,
        label,
      })),
    ],
  });

  await prisma.approvalRule.createMany({
    data: DEFAULT_RULES.map((rule) => ({
      visitType: rule.visitType,
      vip: Boolean(rule.vip),
      stepsJson: JSON.stringify(rule.steps),
    })),
  });

  const visitors = await Promise.all(
    [
      ["Rania Abboud", "70900101", "rania.abboud@northline.com", "Lebanese", "Northline Trading", "Procurement Lead", "CUSTOMER"],
      ["Pierre Mansour", "70900102", "pierre@atlas-supply.com", "Lebanese", "Atlas Supply", "Account Director", "SUPPLIER"],
      ["Elena Rossi", "70900103", "elena.rossi@meridian.eu", "Italian", "Meridian Partners", "Regional Director", "VIP"],
      ["Hassan Diab", "70900104", "hassan.diab@gmail.com", "Lebanese", "Independent", "Candidate", "CANDIDATE"],
      ["Nour Kassem", "70900105", "nour@qadisha.io", "Lebanese", "Qadisha Systems", "Solutions Engineer", "SUPPLIER"],
      ["David Chen", "70900106", "dchen@pacific-audit.com", "Singaporean", "Pacific Audit", "Lead Auditor", "AUDITOR"],
      ["Lina Farhat", "70900107", "lina.farhat@orion.group", "Lebanese", "Orion Group", "Commercial Manager", "CUSTOMER"],
      ["Karim Bouzid", "70900108", "kb@walkin.local", "Lebanese", "Bouzid Contracting", "Site Supervisor", "CONTRACTOR"],
      ["Amira Solh", "70900109", "amira@solh-law.com", "Lebanese", "Solh & Partners", "Counsel", "PARTNER"],
      ["Tomas Novak", "70900110", "tomas@ceecorp.cz", "Czech", "CEE Corp", "Delegation Lead", "GUEST"],
      ["Sara Njeim", "70900111", "sara.njeim@outlook.com", "Lebanese", "—", "Visitor", "GUEST"],
      ["Restricted Party", "70900999", "blocked@example.com", "Unknown", "Blocked Co", "Agent", "GUEST"],
    ].map(([fullName, mobile, email, nationality, company, jobTitle, visitorType]) =>
      prisma.visitor.create({
        data: {
          fullName,
          mobile,
          email,
          nationality,
          company,
          jobTitle,
          visitorType,
          idType: "NATIONAL_ID",
          idReference: mobile.startsWith("70900") ? `ID-${mobile}` : null,
          restricted: fullName === "Restricted Party",
          restrictionNote: fullName === "Restricted Party" ? "Access denied by Administration." : null,
        },
      }),
    ),
  );

  const v = Object.fromEntries(visitors.map((item) => [item.fullName, item]));

  type SeedVisit = {
    code: number;
    type: string;
    status: string;
    purpose: string;
    description?: string;
    day: Date;
    from: [number, number];
    to?: [number, number];
    host: string;
    dept: string;
    location: string;
    room?: string;
    visitor: string;
    extras?: string[];
    vip?: boolean;
    parking?: boolean;
    plate?: string;
    slot?: string;
    gateIn?: string;
    gateOut?: string;
    checkInOffsetMin?: number;
    checkOutOffsetMin?: number;
    invite?: boolean;
    approvals?: { name: string; role: string; status: string; assignee?: string }[];
    notes?: string;
    hospitality?: {
      fromAbroad?: boolean;
      originCountry?: string;
      originCity?: string;
      stayNights?: number;
      flightArrival?: string;
      flightDeparture?: string;
      hotelRequired?: boolean;
      hotelName?: string;
      hotelBookingStatus?: string;
      hotelRoomType?: string;
      pickupRequired?: boolean;
      pickupType?: string;
      pickupFrom?: string;
      pickupTime?: string;
      dropoffRequired?: boolean;
      mealBreakfast?: boolean;
      mealLunch?: boolean;
      mealDinner?: boolean;
      dietaryNeeds?: string;
      hospitalityNotes?: string;
    };
  };

  const rows: SeedVisit[] = [
    {
      code: 118,
      type: "CUSTOMER",
      status: "CURRENTLY_INSIDE",
      purpose: "Quarterly account review and contract renewal discussion",
      day: TODAY,
      from: [9, 30],
      to: [11, 30],
      host: "sakour@neweast.co",
      dept: "SALES",
      location: "Sales Floor",
      room: "Meeting Room 1",
      visitor: "Rania Abboud",
      parking: true,
      plate: "B 44521",
      slot: "B1-18",
      gateIn: "Main Gate",
      checkInOffsetMin: -80,
      invite: true,
    },
    {
      code: 119,
      type: "VIP",
      status: "EXPECTED",
      purpose: "Strategic partnership briefing with executive management",
      day: TODAY,
      from: [14, 0],
      to: [16, 0],
      host: "samira.exec@neweast.com",
      dept: "EXEC",
      location: "Executive Floor",
      room: "Boardroom A",
      visitor: "Elena Rossi",
      vip: true,
      parking: true,
      plate: "G 1001",
      invite: true,
      hospitality: {
        fromAbroad: true,
        originCountry: "Italy",
        originCity: "Milan",
        stayNights: 3,
        flightArrival: "AZ 826 · 12:10",
        flightDeparture: "AZ 827 · 18:40",
        hotelRequired: true,
        hotelName: "Four Seasons Beirut",
        hotelBookingStatus: "CONFIRMED",
        hotelRoomType: "Deluxe king",
        pickupRequired: true,
        pickupType: "HQ_CAR",
        pickupFrom: "BEY Airport arrivals",
        pickupTime: "12:30",
        dropoffRequired: true,
        mealLunch: true,
        mealDinner: true,
        dietaryNeeds: "No shellfish",
        hospitalityNotes: "VIP protocol. Late check-in after the board briefing.",
      },
    },
    {
      code: 120,
      type: "SUPPLIER",
      status: "PENDING_APPROVAL",
      purpose: "Review of spare-parts SLA and delivery schedule",
      day: addDays(TODAY, 1),
      from: [10, 0],
      to: [12, 0],
      host: "hana.ops@neweast.com",
      dept: "OPS",
      location: "Operations Wing",
      room: "Meeting Room 2",
      visitor: "Pierre Mansour",
      approvals: [
        { name: "Department manager", role: "DEPARTMENT_MANAGER", status: "APPROVED", assignee: "hana.ops@neweast.com" },
        { name: "Administration approval", role: "HR_ADMIN", status: "PENDING" },
      ],
    },
    {
      code: 121,
      type: "WALK_IN",
      status: "PENDING_APPROVAL",
      purpose: "Urgent delivery confirmation for operations shipment",
      day: TODAY,
      from: [11, 10],
      to: [12, 0],
      host: "hana.ops@neweast.com",
      dept: "OPS",
      location: "Lobby / Reception",
      visitor: "Karim Bouzid",
      approvals: [{ name: "Host / department approval", role: "EMPLOYEE", status: "PENDING", assignee: "hana.ops@neweast.com" }],
    },
    {
      code: 122,
      type: "CANDIDATE",
      status: "EXPECTED",
      purpose: "Final-round interview for Talent Partner role",
      day: TODAY,
      from: [15, 30],
      to: [16, 30],
      host: "navami.balachandran@neweast.co",
      dept: "HR",
      location: "HR Suite",
      room: "Interview Room 1",
      visitor: "Hassan Diab",
      invite: true,
    },
    {
      code: 123,
      type: "CUSTOMER",
      status: "OVERDUE",
      purpose: "Implementation follow-up for finance module",
      day: TODAY,
      from: [8, 30],
      to: [10, 0],
      host: "yousef.fin@neweast.com",
      dept: "FIN",
      location: "Finance Floor",
      room: "Meeting Room 3",
      visitor: "Lina Farhat",
      gateIn: "Main Gate",
      checkInOffsetMin: -180,
      invite: true,
    },
    {
      code: 124,
      type: "GROUP",
      status: "APPROVED",
      purpose: "Corporate delegation visit to explore NEWEAST operations",
      day: addDays(TODAY, 2),
      from: [9, 0],
      to: [13, 0],
      host: "samira.exec@neweast.com",
      dept: "EXEC",
      location: "Training Hall",
      room: "Training Hall",
      visitor: "Tomas Novak",
      extras: ["Elena Rossi"],
      invite: false,
      hospitality: {
        fromAbroad: true,
        originCountry: "Czech Republic",
        originCity: "Prague",
        stayNights: 2,
        flightArrival: "OK 302",
        hotelRequired: true,
        hotelName: "Le Gray",
        hotelBookingStatus: "REQUESTED",
        hotelRoomType: "Twin x 4",
        pickupRequired: true,
        pickupType: "DRIVER",
        pickupFrom: "BEY Airport",
        pickupTime: "08:15",
        mealBreakfast: true,
        mealLunch: true,
        hospitalityNotes: "Delegation of 4. Need meeting lunch in Training Hall.",
      },
    },
    {
      code: 125,
      type: "EMPLOYEE_VISIT",
      status: "COMPLETED",
      purpose: "Legal consultation on supplier framework agreement",
      day: subDays(TODAY, 1),
      from: [11, 0],
      to: [12, 30],
      host: "sakour@neweast.co",
      dept: "LEGAL",
      location: "Legal",
      room: "Meeting Room 2",
      visitor: "Amira Solh",
      gateIn: "Main Gate",
      gateOut: "Main Gate",
      checkInOffsetMin: -60,
      checkOutOffsetMin: 30,
      invite: true,
    },
    {
      code: 126,
      type: "SUPPLIER",
      status: "NO_SHOW",
      purpose: "On-site inspection of IT network cabinets",
      day: TODAY,
      from: [8, 0],
      to: [9, 0],
      host: "sakour@neweast.co",
      dept: "IT",
      location: "IT Center",
      visitor: "Nour Kassem",
      invite: true,
    },
    {
      code: 127,
      type: "GENERAL",
      status: "REJECTED",
      purpose: "Request to tour headquarters without a scheduled host",
      day: TODAY,
      from: [13, 0],
      to: [14, 0],
      host: "olga@neweast.co",
      dept: "HR",
      location: "Lobby / Reception",
      visitor: "Sara Njeim",
      approvals: [{ name: "Administration approval", role: "HR_ADMIN", status: "REJECTED", assignee: "olga@neweast.co" }],
    },
    {
      code: 128,
      type: "CUSTOMER",
      status: "DRAFT",
      purpose: "Prepare follow-up meeting for Northline expansion",
      day: addDays(TODAY, 3),
      from: [10, 30],
      to: [11, 30],
      host: "sakour@neweast.co",
      dept: "SALES",
      location: "Sales Floor",
      visitor: "Rania Abboud",
    },
    {
      code: 129,
      type: "SUPPLIER",
      status: "COMPLETED",
      purpose: "Annual audit kickoff and document request",
      day: subDays(TODAY, 5),
      from: [9, 0],
      to: [12, 0],
      host: "yousef.fin@neweast.com",
      dept: "FIN",
      location: "Finance Floor",
      room: "Boardroom B",
      visitor: "David Chen",
      gateIn: "Staff Entrance",
      gateOut: "Staff Entrance",
      checkInOffsetMin: -20,
      checkOutOffsetMin: 160,
      invite: true,
      hospitality: {
        fromAbroad: true,
        originCountry: "Singapore",
        originCity: "Singapore",
        stayNights: 4,
        hotelRequired: true,
        hotelName: "Phoenicia",
        hotelBookingStatus: "CONFIRMED",
        pickupRequired: true,
        pickupType: "TAXI",
        mealLunch: true,
        dietaryNeeds: "Vegetarian",
      },
    },
    {
      code: 130,
      type: "WALK_IN",
      status: "COMPLETED",
      purpose: "Collect signed delivery note from procurement",
      day: subDays(TODAY, 2),
      from: [16, 0],
      to: [16, 40],
      host: "hana.ops@neweast.com",
      dept: "PROC",
      location: "Procurement",
      visitor: "Pierre Mansour",
      gateIn: "Loading Bay",
      gateOut: "Loading Bay",
      checkInOffsetMin: 0,
      checkOutOffsetMin: 35,
    },
    {
      code: 131,
      type: "EMPLOYEE_VISIT",
      status: "INVITATION_SENT",
      purpose: "Product demo for the sales enablement team",
      day: addDays(TODAY, 4),
      from: [11, 0],
      to: [12, 30],
      host: "jesman@neweast.co",
      dept: "SALES",
      location: "Innovation Lab",
      visitor: "Nour Kassem",
      invite: true,
    },
    {
      code: 132,
      type: "CUSTOMER",
      status: "CANCELLED",
      purpose: "Store rollout planning session",
      day: addDays(TODAY, 1),
      from: [15, 0],
      to: [16, 0],
      host: "sakour@neweast.co",
      dept: "SALES",
      location: "Sales Floor",
      visitor: "Lina Farhat",
      notes: "Host cancelled — client requested a later date.",
    },
    {
      code: 133,
      type: "VIP",
      status: "COMPLETED",
      purpose: "Courtesy visit by regional partner leadership",
      day: subDays(TODAY, 8),
      from: [10, 0],
      to: [11, 30],
      host: "samira.exec@neweast.com",
      dept: "EXEC",
      location: "Executive Floor",
      room: "Boardroom A",
      visitor: "Elena Rossi",
      vip: true,
      gateIn: "Executive Entrance",
      gateOut: "Executive Entrance",
      checkInOffsetMin: -10,
      checkOutOffsetMin: 80,
      invite: true,
      hospitality: {
        fromAbroad: true,
        originCountry: "Italy",
        originCity: "Milan",
        stayNights: 1,
        hotelRequired: true,
        hotelName: "Four Seasons Beirut",
        hotelBookingStatus: "CONFIRMED",
        pickupRequired: true,
        pickupType: "HQ_CAR",
        mealLunch: true,
      },
    },
  ];

  let seq = 0;
  for (const row of rows) {
    seq = Math.max(seq, row.code);
    const host = user[row.host];
    const visitor = v[row.visitor];
    const expectedArrival = at(row.day, row.from[0], row.from[1]);
    const expectedDeparture = row.to ? at(row.day, row.to[0], row.to[1]) : addHours(expectedArrival, 2);
    const checkInAt =
      row.checkInOffsetMin != null ? addMinutes(expectedArrival, row.checkInOffsetMin) : null;
    const checkOutAt =
      row.checkOutOffsetMin != null && checkInAt
        ? addMinutes(checkInAt, row.checkOutOffsetMin)
        : null;
    const visit = await prisma.visit.create({
      data: {
        visitCode: `GV-2026-${String(row.code).padStart(6, "0")}`,
        type: row.type,
        status: row.status,
        purpose: row.purpose,
        description: row.description || row.purpose,
        visitDate: row.day,
        expectedArrival,
        expectedDeparture,
        hostId: host.id,
        departmentId: dept[row.dept].id,
        location: row.location,
        meetingRoom: row.room,
        visitorCount: 1 + (row.extras?.length ?? 0),
        parkingRequired: Boolean(row.parking || row.plate),
        vip: Boolean(row.vip || row.type === "VIP"),
        accessArea: row.vip ? "Executive Suite" : "General Offices",
        qrToken: makeQrToken(),
        createdById: host.id,
        cancelReason: row.status === "CANCELLED" ? row.notes : null,
        cancelSource: row.status === "CANCELLED" ? "HOST" : null,
        checkInAt,
        checkInById: checkInAt ? user["karim.guard@neweast.com"].id : null,
        entryGate: row.gateIn,
        verificationStatus: checkInAt ? "VERIFIED" : null,
        checkOutAt,
        checkOutById: checkOutAt ? user["karim.guard@neweast.com"].id : null,
        exitGate: row.gateOut,
        badgeReturned: checkOutAt ? true : null,
        durationMinutes: checkInAt && checkOutAt ? row.checkOutOffsetMin : null,
        invitationSentAt: row.invite ? subDays(expectedArrival, 1) : null,
        invitationChannel: row.invite ? "EMAIL" : null,
        internalNotes: row.notes || null,
        fromAbroad: Boolean(row.hospitality?.fromAbroad),
        originCountry: row.hospitality?.originCountry,
        originCity: row.hospitality?.originCity,
        stayNights: row.hospitality?.stayNights,
        stayFrom: row.hospitality?.stayNights ? row.day : undefined,
        stayTo: row.hospitality?.stayNights ? addDays(row.day, row.hospitality.stayNights) : undefined,
        flightArrival: row.hospitality?.flightArrival,
        flightDeparture: row.hospitality?.flightDeparture,
        hotelRequired: Boolean(row.hospitality?.hotelRequired),
        hotelName: row.hospitality?.hotelName,
        hotelBookingStatus: row.hospitality?.hotelBookingStatus,
        hotelRoomType: row.hospitality?.hotelRoomType,
        pickupRequired: Boolean(row.hospitality?.pickupRequired),
        pickupType: row.hospitality?.pickupType,
        pickupFrom: row.hospitality?.pickupFrom,
        pickupTime: row.hospitality?.pickupTime,
        dropoffRequired: Boolean(row.hospitality?.dropoffRequired),
        mealBreakfast: Boolean(row.hospitality?.mealBreakfast),
        mealLunch: Boolean(row.hospitality?.mealLunch),
        mealDinner: Boolean(row.hospitality?.mealDinner),
        dietaryNeeds: row.hospitality?.dietaryNeeds,
        hospitalityNotes: row.hospitality?.hospitalityNotes,
      },
    });

    await prisma.visitVisitor.create({
      data: { visitId: visit.id, visitorId: visitor.id, isPrimary: true },
    });
    for (const extra of row.extras ?? []) {
      await prisma.visitVisitor.create({
        data: { visitId: visit.id, visitorId: v[extra].id, isPrimary: false },
      });
    }
    if (row.plate) {
      await prisma.vehicle.create({
        data: {
          visitId: visit.id,
          plate: row.plate,
          vehicleType: "Sedan",
          parkingSlot: row.slot,
        },
      });
    }
    if (checkInAt) {
      await prisma.badge.create({
        data: {
          visitId: visit.id,
          number: `VB-${1000 + row.code}`,
          issuedAt: checkInAt,
          returnedAt: checkOutAt,
          closed: Boolean(checkOutAt),
        },
      });
    }
    if (row.approvals) {
      await prisma.approval.createMany({
        data: row.approvals.map((step, index) => ({
          visitId: visit.id,
          stepOrder: index + 1,
          stepName: step.name,
          requiredRole: step.role,
          assigneeId: step.assignee ? user[step.assignee].id : null,
          status: step.status,
          decidedAt: step.status !== "PENDING" ? subDays(TODAY, 0) : null,
        })),
      });
    } else if (row.status !== "DRAFT") {
      await prisma.approval.create({
        data: {
          visitId: visit.id,
          stepOrder: 1,
          stepName: "Administration approval",
          requiredRole: "HR_ADMIN",
          assigneeId: user["olga@neweast.co"].id,
          status: ["REJECTED"].includes(row.status) ? "REJECTED" : "APPROVED",
          decidedAt: subDays(expectedArrival, 1),
        },
      });
    }

    const events = ["Visit created"];
    if (row.status !== "DRAFT") events.push("Approval requested");
    if (!["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(row.status)) events.push("Approved");
    if (row.invite) events.push("Invitation sent");
    if (checkInAt) events.push("Visitor verified", "Security check-in", "Badge issued");
    if (row.status === "OVERDUE") events.push("Overdue");
    if (checkOutAt) events.push("Check-out");
    if (row.status === "CANCELLED") events.push("Visit cancelled");
    if (row.status === "REJECTED") events.push("Rejected");
    if (row.status === "NO_SHOW") events.push("No show");
    await prisma.timelineEvent.createMany({
      data: events.map((event, index) => ({
        visitId: visit.id,
        event,
        userId: host.id,
        createdAt: addMinutes(subDays(expectedArrival, 1), index * 8),
      })),
    });
  }

  await prisma.systemSetting.update({
    where: { key: "visit_seq_2026" },
    data: { value: String(seq) },
  });

  const sampleVisit = await prisma.visit.findFirst({ where: { visitCode: "GV-2026-000119" } });
  await prisma.notification.createMany({
    data: [
      {
        userId: user["sakour@neweast.co"].id,
        visitId: (await prisma.visit.findFirst({ where: { visitCode: "GV-2026-000118" } }))?.id,
        type: "VISITOR_CHECKED_IN",
        title: "Visitor checked in",
        message: "Your visitor has arrived and completed security check-in at the NEWEAST Headquarters.",
      },
      {
        userId: user["hana.ops@neweast.com"].id,
        visitId: (await prisma.visit.findFirst({ where: { visitCode: "GV-2026-000121" } }))?.id,
        type: "APPROVAL_REQUIRED",
        title: "Walk-in approval required",
        message: "Karim Bouzid is waiting at the Main Gate.",
      },
      {
        userId: user["olga@neweast.co"].id,
        visitId: (await prisma.visit.findFirst({ where: { visitCode: "GV-2026-000120" } }))?.id,
        type: "APPROVAL_REQUIRED",
        title: "Visit approval required",
        message: "GV-2026-000120 needs administration approval.",
      },
      {
        userId: user["karim.guard@neweast.com"].id,
        visitId: sampleVisit?.id,
        type: "VISITOR_ARRIVING_TODAY",
        title: "VIP arriving today",
        message: "Elena Rossi is expected at 14:00 at the Executive Entrance.",
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: user["sakour@neweast.co"].id, action: "Visit created", module: "Visit Requests" },
      { userId: user["olga@neweast.co"].id, action: "Approved", module: "Approvals" },
      { userId: user["karim.guard@neweast.com"].id, action: "Security check-in", module: "Security Desk" },
    ],
  });

  await upsertServiceCatalog();
  console.log("Seeded NEWEAST Guest Visit demo data.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
