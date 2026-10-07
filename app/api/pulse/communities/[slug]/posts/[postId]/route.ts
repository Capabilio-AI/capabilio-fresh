import { NextResponse } from "next/server";
import { z } from "zod";
import { withCommunity } from "@/lib/pulse/community-route";
import { deleteCommunityPost } from "@/lib/pulse/community-feed";

type Ctx = { params: Promise<{ slug: string; postId: string }> };

export const DELETE = (_r: Request, { params }: Ctx) =>
  withCommunity(params, async ({ userId, service, community, access }) => {
    const id = z.string().uuid().safeParse((await params).postId);
    if (!id.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const r = await deleteCommunityPost(service, userId, access, community, id.data);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.message }, { status: r.status });
  });
