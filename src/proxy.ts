import { NextResponse, type NextRequest } from "next/server";
import { INTRANET_CORS_HEADERS } from "@/lib/intranet-api";
import { publicUrl, safeNext } from "@/lib/safe-next";

const PUBLIC = ["/login", "/sso", "/invite", "/guide", "/display", "/api/display", "/api/intranet"];

function appUrl(request: NextRequest, path: string) {
  const base = request.nextUrl.basePath || "";
  return publicUrl(`${base}${path}`, request.headers);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = request.nextUrl.searchParams.get("uSrId");
  const otp = request.nextUrl.searchParams.get("LoTp");
  if (userId && otp && pathname !== "/sso") {
    const sso = appUrl(request, "/sso");
    sso.searchParams.set("uSrId", userId);
    sso.searchParams.set("LoTp", otp);
    const company = request.nextUrl.searchParams.get("co");
    if (company) sso.searchParams.set("co", company);
    const next =
      pathname === "/" || pathname === "/login"
        ? request.nextUrl.searchParams.get("next") || ""
        : pathname;
    if (next) sso.searchParams.set("next", next);
    return NextResponse.redirect(sso);
  }

  if (pathname === "/api/intranet" || pathname.startsWith("/api/intranet/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: INTRANET_CORS_HEADERS });
    }
  }

  const token = request.cookies.get("neweast_session")?.value;
  const isPublic = PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!token && !isPublic && pathname !== "/") {
    const login = appUrl(request, "/login");
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (token && pathname === "/login") {
    return NextResponse.redirect(appUrl(request, safeNext(request.nextUrl.searchParams.get("next"))));
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xlsx|pdf|pptx|mp4|srt)$).*)"],
};
