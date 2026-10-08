import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeOrg, orgRoute } from "@/lib/api/org-route";
import { canAccessChannel, loadMessages, markRead } from "@/lib/org/chat";
import { untyped } from "@/lib/org/db";
import { AttachmentInput, attachmentColumns, attachmentIsOwn, signAttachments } from "@/lib/pulse/chat-attachment";

const SendSchema = z
  .object({ channelId: z.string().uuid(), body: z.string().trim().max(2000).default(""), attachment: AttachmentInput.optional() })
  .strict()
  .refine((v) => v.body.length > 0 || v.attachment, { path: ["body"], message: "Write a message or attach a file." });

/** Post a message. Only members of the channel's college (and, if private, of the channel) can. */
export async function POST(request: Request) {
  return orgRoute(request, SendSchema, "useChat", async ({ ctx, service }, body) => {
    if (!(await canAccessChannel(service, ctx, body.channelId))) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    if (body.attachment && !attachmentIsOwn(ctx.userId, body.attachment)) return NextResponse.json({ error: "Upload the file again and retry." }, { status: 400 });
    const cols = attachmentColumns(body.attachment);
    const { data, error } = await untyped(service).from("org_chat_messages").insert({ channel_id: body.channelId, author_user_id: ctx.userId, body: body.body, ...cols }).select("id, created_at").single();
    if (error) throw error;
    await markRead(service, ctx, body.channelId);
    const [attachment] = await signAttachments(service, [cols]);
    return { id: (data as { id: string }).id, createdAt: (data as { created_at: string }).created_at, attachment };
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
