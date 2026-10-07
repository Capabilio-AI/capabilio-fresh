import { NextResponse } from "next/server";
import { z } from "zod";
import { withCommunity } from "@/lib/pulse/community-route";
import { removeMember } from "@/lib/pulse/communities";

/** A moderator removes a member (and bars them from rejoining). */
export const DELETE = (_r: Request, { params }: { params: Promise<{ slug: string; userId: string }> }) =>
  withCommunity(params, async ({ userId, service, community }) => {
    const target = z.string().uuid().safeParse((await params).userId);
    if (!target.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const r = await removeMember(service, userId, community, target.data);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.message }, { status: r.status });
  });
