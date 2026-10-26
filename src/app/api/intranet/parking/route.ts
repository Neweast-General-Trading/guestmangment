import { NextResponse } from "next/server";
import { intranetApiKey, intranetKeyOk, readIntranetApiKey, withIntranetCors } from "@/lib/intranet-api";
import { findIntranetParking, readIntranetParkingQuery } from "@/lib/intranet-parking";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return withIntranetCors(NextResponse.json(body, { status }));
}

export async function OPTIONS() {
  return withIntranetCors(new NextResponse(null, { status: 204 }));
}

async function lookup(request: Request, raw: Record<string, unknown>) {
  if (!intranetApiKey()) return json({ error: "Intranet parking is not configured." }, 503);
  if (!intranetKeyOk(readIntranetApiKey(request))) {
    return json({ error: "Unauthorized." }, 401);
  }
  const query = readIntranetParkingQuery(raw);
  if (!query.email && !query.empId) {
    return json({ error: "Send email or empId." }, 400);
  }
  return json(await findIntranetParking(query));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return lookup(request, {
    email: url.searchParams.get("email"),
    mail: url.searchParams.get("mail"),
    userEmail: url.searchParams.get("userEmail"),
    empId: url.searchParams.get("empId"),
    payrollNo: url.searchParams.get("payrollNo"),
  });
}

export async function POST(request: Request) {
  let raw: Record<string, unknown> = {};
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) raw = body as Record<string, unknown>;
  } catch {
    return json({ error: "Send a JSON object." }, 400);
  }
  return lookup(request, raw);
}
