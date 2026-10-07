import { NextResponse } from "next/server";
import { z } from "zod";
import { withCommunity } from "@/lib/pulse/community-route";
import { toggleCommunityLike } from "@/lib/pulse/community-feed";

export const POST = (_r: Request, { params }: { params: Promise<{ slug: string; postId: string }> }) =>
  withCommunity(params, async ({ userId, service, community, access }) => {
    const id = z.string().uuid().safeParse((await params).postId);
    if (!id.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const r = await toggleCommunityLike(service, userId, access, community, id.data);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.message }, { status: r.status });
  });
