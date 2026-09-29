import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeOrg, orgRoute } from "@/lib/api/org-route";
import { canAccessChannel, loadMessages, markRead } from "@/lib/org/chat";
import { untyped } from "@/lib/org/db";

const SendSchema = z.object({ channelId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).strict();

/** Post a message. Only members of the channel's college (and, if private, of the channel) can. */
export async function POST(request: Request) {
  return orgRoute(request, SendSchema, "useChat", async ({ ctx, service }, body) => {
    if (!(await canAccessChannel(service, ctx, body.channelId))) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    const { data, error } = await untyped(service).from("org_chat_messages").insert({ channel_id: body.channelId, author_user_id: ctx.userId, body: body.body }).select("id, created_at").single();
    if (error) throw error;
    await markRead(service, ctx, body.channelId);
    return { id: (data as { id: string }).id, createdAt: (data as { created_at: string }).created_at };
  });
}

/** Poll for messages newer than `after` (or the latest page when omitted). Reading marks the channel read. */
export async function GET(request: Request) {
  const env = await authorizeOrg("useChat");
  if (env instanceof NextResponse) return env;
  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId") ?? "";
  const after = url.searchParams.get("after") ?? undefined;
  if (!/^[0-9a-f-]{36}$/i.test(channelId) || (after && Number.isNaN(Date.parse(after)))) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (!(await canAccessChannel(env.service, env.ctx, channelId))) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  const messages = await loadMessages(env.service, channelId, after);
  await markRead(env.service, env.ctx, channelId);
  return NextResponse.json({ ok: true, messages }, { headers: { "Cache-Control": "no-store" } });
}
