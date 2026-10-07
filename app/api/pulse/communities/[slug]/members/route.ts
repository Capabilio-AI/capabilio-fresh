import { NextResponse } from "next/server";
import { withCommunity } from "@/lib/pulse/community-route";
import { listMembers } from "@/lib/pulse/communities";

export const GET = (_r: Request, { params }: { params: Promise<{ slug: string }> }) =>
  withCommunity(params, async ({ service, community, summary }) => NextResponse.json({ members: await listMembers(service, community), total: summary.memberCount }));
