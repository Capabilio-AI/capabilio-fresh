import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getFeed, type FeedMode } from "@/lib/pulse/data";
import { ownsMedia } from "@/lib/pulse/media";
import { PostInputSchema, toRowFields } from "@/lib/pulse/post-schema";
import { getRankedFeed } from "@/lib/pulse/ranked-feed";

const KINDS = ["post", "project", "question", "achievement", "opportunity", "resource"] as const;
const QuerySchema = z.object({
  mode: z.enum(["for_you", "following", "trending", "user", "tag", "mentors"]).default("for_you"),
  userId: z.string().uuid().optional(),
  kind: z.enum(KINDS).optional(),
  tag: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{1,29}$/).optional(),
  /** chronological views */
  before: z.string().datetime({ offset: true }).optional(),
  /** ranked views */
  cursor: z.string().max(40).optional(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { mode, userId, kind, tag, before, cursor } = parsed.data;
  const service = createServiceClient();

  if (mode === "for_you" || mode === "following" || mode === "trending") return NextResponse.json(await getRankedFeed(supabase, service, auth.userId, mode, cursor ?? null));

  let feed: FeedMode = { mode: "mentors" };
  if (mode === "user") {
    if (!userId) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    feed = { mode, userId, kind };
  }
  if (mode === "tag") {
    if (!tag) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    feed = { mode, tag: tag.toLowerCase() };
  }
  return NextResponse.json(await getFeed(supabase, service, auth.userId, feed, before ?? null));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "pulse_post", maxRequests: 20, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const parsed = PostInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check what you wrote and try again." }, { status: 400 });
  const input = parsed.data;
  if (input.imagePath && !ownsMedia(auth.userId, "post", input.imagePath)) return NextResponse.json({ error: "That image wasn't uploaded by you." }, { status: 400 });
  if (input.attachment && !ownsMedia(auth.userId, "doc", input.attachment.path)) return NextResponse.json({ error: "That document wasn't uploaded by you." }, { status: 400 });

  const { error } = await supabase.from("posts").insert({ user_id: auth.userId, ...toRowFields(input) } as never);
  if (error) {
    console.error("[pulse] post failed:", error.message);
    return NextResponse.json({ error: "Couldn't post. Please try again." }, { status: 500 });
  }
  return NextResponse.json(await getRankedFeed(supabase, createServiceClient(), auth.userId, "for_you", null), { status: 201 });
}
