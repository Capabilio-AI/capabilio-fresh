import { NextResponse } from "next/server";
import { z } from "zod";
import { withCommunity } from "@/lib/pulse/community-route";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { createCommunityPost, getCommunityFeed } from "@/lib/pulse/community-feed";

const KINDS = ["post", "project", "question", "achievement"] as const;
const CreateSchema = z.object({ content: z.string().trim().min(1).max(3000), kind: z.enum(KINDS).default("post"), imagePath: z.string().max(300).optional() }).strict();
const Query = z.object({ before: z.string().datetime({ offset: true }).optional() });

// Interest communities are readable by anyone signed in; college and branch ones were already restricted to their own people by the gate.
export const GET = (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
  withCommunity(params, async ({ userId, service, community }) => {
    const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!q.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    return NextResponse.json(await getCommunityFeed(service, userId, community, q.data.before ?? null));
  });

export const POST = (request: Request, { params }: { params: Promise<{ slug: string }> }) =>
  withCommunity(params, async ({ userId, service, community, access }) => {
    const limit = await checkRateLimit(userId, { bucket: "community_post", maxRequests: 30, windowSeconds: 3600 });
    if (!limit.allowed) return rateLimitedResponse(limit.remaining);
    const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Write something (up to 3000 characters)." }, { status: 400 });
    const result = await createCommunityPost(service, userId, access, community, parsed.data);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    return NextResponse.json(await getCommunityFeed(service, userId, community, null), { status: 201 });
  });
