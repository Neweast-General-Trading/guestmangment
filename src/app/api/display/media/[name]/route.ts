import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveDisplayMedia } from "@/lib/display-media";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const media = resolveDisplayMedia(name);
  if (!media) return new NextResponse("Not found", { status: 404 });
  const body = await readFile(media.file);
  return new NextResponse(body, {
    headers: {
      "content-type": media.type,
      "cache-control": "public, max-age=86400",
    },
  });
}
