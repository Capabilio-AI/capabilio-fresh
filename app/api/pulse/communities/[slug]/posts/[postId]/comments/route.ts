import { NextResponse } from "next/server";
import { z } from "zod";
import { withCommunity } from "@/lib/pulse/community-route";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { addCommunityComment } from "@/lib/pulse/community-feed";

const Body = z.object({ content: z.string().trim().min(1).max(1000) }).strict();

export const POST = (request: Request, { params }: { params: Promise<{ slug: string; postId: string }> }) =>
  withCommunity(params, async ({ userId, service, community, access }) => {
    const limit = await checkRateLimit(userId, { bucket: "community_comment", maxRequests: 60, windowSeconds: 3600 });
    if (!limit.allowed) return rateLimitedResponse(limit.remaining);
    const id = z.string().uuid().safeParse((await params).postId);
    const body = Body.safeParse(await request.json().catch(() => null));
    if (!id.success || !body.success) return NextResponse.json({ error: "Write a comment." }, { status: 400 });
    const r = await addCommunityComment(service, userId, access, community, id.data, body.data.content);
    return r.ok ? NextResponse.json({ comment: r.comment }, { status: 201 }) : NextResponse.json({ error: r.message }, { status: r.status });
  });
