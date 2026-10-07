import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { createStory, loadTray } from "@/lib/pulse/stories";

const Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), body: z.string().trim().min(1).max(280), theme: z.number().int().min(0).max(7).default(0) }).strict(),
  z.object({ kind: z.literal("image"), imagePath: z.string().max(300), body: z.string().trim().max(280).optional() }).strict(),
]);

export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json({ groups: await loadTray(createServiceClient(), auth.userId) });
}

export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "pulse_story", maxRequests: 30, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a story of up to 280 characters, or add an image." }, { status: 400 });
  const service = createServiceClient();
  const result = await createStory(service, auth.userId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id, groups: await loadTray(service, auth.userId) }, { status: 201 });
}
