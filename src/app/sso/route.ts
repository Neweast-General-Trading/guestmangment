import { NextResponse, type NextRequest } from "next/server";
import { loginFromIntranetLink } from "@/lib/intranet-sso";
import { homeFor } from "@/lib/permissions";
import { publicUrl, safeNext } from "@/lib/safe-next";

function appUrl(request: NextRequest, path: string) {
  return publicUrl(path, request.headers);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const result = await loginFromIntranetLink({
    userId: query.get("uSrId"),
    otp: query.get("LoTp"),
    company: query.get("co"),
  });
  if (!result.ok) {
    const login = appUrl(request, "/login");
    login.searchParams.set("error", result.error);
    const next = query.get("next");
    if (next) login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }
  const next = (query.get("next") || "").trim();
  return NextResponse.redirect(appUrl(request, next ? safeNext(next) : homeFor(result.role)));
}
