import { timingSafeEqual } from "node:crypto";

export const INTRANET_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Intranet-Key",
  "Access-Control-Max-Age": "86400",
} as const;

export function intranetApiKey() {
  return (process.env.INTRANET_API_KEY || "").trim();
}

export function readIntranetApiKey(request: Request) {
  const header = request.headers.get("x-intranet-key")?.trim() || "";
  if (header) return header;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  return bearer;
}

export function intranetKeyOk(provided: string) {
  const expected = intranetApiKey();
  if (!expected || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function withIntranetCors(response: Response) {
  for (const [name, value] of Object.entries(INTRANET_CORS_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
