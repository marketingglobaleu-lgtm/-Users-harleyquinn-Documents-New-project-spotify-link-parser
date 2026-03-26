import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/spotify-session";

export async function GET() {
  const session = await getUserSession();

  return NextResponse.json({
    connected: Boolean(session),
    expiresAt: session?.expiresAt ?? null
  });
}
