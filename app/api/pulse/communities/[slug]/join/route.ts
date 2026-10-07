import { NextResponse } from "next/server";
import { withCommunity } from "@/lib/pulse/community-route";
import { joinCommunity, leaveCommunity } from "@/lib/pulse/communities";

type Ctx = { params: Promise<{ slug: string }> };
const answer = (r: { ok: true } | { ok: false; status: number; message: string }) => (r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.message }, { status: r.status }));

export const POST = (_r: Request, { params }: Ctx) => withCommunity(params, async ({ userId, service, community }) => answer(await joinCommunity(service, userId, community)));
export const DELETE = (_r: Request, { params }: Ctx) => withCommunity(params, async ({ userId, service, community }) => answer(await leaveCommunity(service, userId, community)));
