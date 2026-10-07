import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { createInterestCommunity, listCommunities } from "@/lib/pulse/communities";

const CreateSchema = z.object({ name: z.string().trim().min(3).max(60), description: z.string().trim().max(400).optional() }).strict();

export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json(await listCommunities(createServiceClient(), auth.userId));
}

/** Start an interest community; you become its owner. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "community_create", maxRequests: 5, windowSeconds: 86_400 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give your community a name of 3-60 characters." }, { status: 400 });
  const result = await createInterestCommunity(createServiceClient(), auth.userId, parsed.data);
  return result.ok ? NextResponse.json({ ok: true, slug: result.slug }, { status: 201 }) : NextResponse.json({ error: result.message }, { status: result.status });
}
