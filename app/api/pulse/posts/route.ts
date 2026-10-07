import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getFeed, type FeedMode } from "@/lib/pulse/data";
import { ownsMedia } from "@/lib/pulse/media";

const KINDS = ["post", "project", "question", "achievement"] as const;
const CreateSchema = z.object({ content: z.string().trim().min(1).max(3000), kind: z.enum(KINDS).default("post"), imagePath: z.string().max(300).optional() }).strict();
const QuerySchema = z.object({
  mode: z.enum(["for_you", "following", "user", "tag"]).default("for_you"),
  userId: z.string().uuid().optional(),
  tag: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{1,29}$/).optional(),
  before: z.string().datetime({ offset: true }).optional(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { mode, userId, tag, before } = parsed.data;
  let feed: FeedMode = { mode: "for_you" };
  if (mode === "following") feed = { mode };
  if (mode === "user") {
    if (!userId) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    feed = { mode, userId };
  }
  if (mode === "tag") {
    if (!tag) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    feed = { mode, tag: tag.toLowerCase() };
  }
  return NextResponse.json(await getFeed(supabase, createServiceClient(), auth.userId, feed, before ?? null));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "pulse_post", maxRequests: 20, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write something (up to 3000 characters)." }, { status: 400 });
  const { content, kind, imagePath } = parsed.data;
  if (imagePath && !ownsMedia(auth.userId, "post", imagePath)) return NextResponse.json({ error: "That image wasn't uploaded by you." }, { status: 400 });

  const { error } = await supabase.from("posts").insert({ user_id: auth.userId, content, kind, image_path: imagePath ?? null } as never);
  if (error) {
    console.error("[pulse] post failed:", error.message);
    return NextResponse.json({ error: "Couldn't post. Please try again." }, { status: 500 });
  }
  return NextResponse.json(await getFeed(supabase, createServiceClient(), auth.userId, { mode: "for_you" }), { status: 201 });
}
