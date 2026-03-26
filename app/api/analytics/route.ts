import { NextResponse } from "next/server";
import { z } from "zod";
import { logEvent } from "@/lib/logger";

const analyticsSchema = z.object({
  name: z.string().min(1),
  payload: z.record(z.any()).optional()
});

export async function POST(request: Request) {
  try {
    const body = analyticsSchema.parse(await request.json());
    logEvent(`analytics_${body.name}`, body.payload ?? {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
