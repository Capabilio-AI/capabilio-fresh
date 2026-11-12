import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeParty } from "@/lib/api/party";
import { untyped } from "@/lib/org/db";
import { loadThreadMessages, markThreadRead, ownThread, staffToNotify } from "@/lib/org/threads";
import { notify } from "@/lib/notifications/notify";

const SendSchema = z.object({ threadId: z.string().uuid(), body: z.string().trim().min(1, "Write a message.").max(2000) }).strict();
const BUCKET_MS = 10 * 60 * 1000;

/** Post a message. Only a member of one of the thread's two organisations can. */
export async function POST(request: Request) {
  const env = await authorizeParty();
  if (env instanceof NextResponse) return env;
  const parsed = SendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { ctx, service } = env;
  const thread = await ownThread(service, ctx, parsed.data.threadId);
  if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const { data, error } = await untyped(service)
    .from("org_thread_messages")
    .insert({ thread_id: thread.id, author_user_id: ctx.userId, author_institution_id: ctx.institutionId, body: parsed.data.body })
    .select("id, created_at")
    .single();
  if (error) {
    console.error("[threads] could not send:", error.message);
    return NextResponse.json({ error: "Message not sent. Try again." }, { status: 500 });
  }
  await markThreadRead(service, ctx.userId, thread.id);
  // one ping per conversation per 10 minutes, so a back-and-forth does not flood the other side's bell
  await notify(service, {
    userIds: await staffToNotify(service, thread.otherId, ctx.kind === "company" ? "college" : "company"),
    type: "thread_message",
    title: `New message from ${ctx.institutionName}`,
    body: parsed.data.body.slice(0, 120),
    href: ctx.kind === "company" ? "/org/companies/messages" : "/company/messages",
    actorId: ctx.userId,
    institutionId: thread.otherId,
    dedupeKey: `thread:${thread.id}:${ctx.institutionId}:${Math.floor(Date.now() / BUCKET_MS)}`,
  });
  const row = data as { id: string; created_at: string };
  return NextResponse.json({ ok: true, id: row.id, createdAt: row.created_at });
}

/** Poll for messages newer than `after`. Reading marks the conversation read. */
export async function GET(request: Request) {
  const env = await authorizeParty();
  if (env instanceof NextResponse) return env;
  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId") ?? "";
  const after = url.searchParams.get("after") ?? undefined;
  if (!/^[0-9a-f-]{36}$/i.test(threadId) || (after && Number.isNaN(Date.parse(after)))) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const thread = await ownThread(env.service, env.ctx, threadId);
  if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const messages = await loadThreadMessages(env.service, env.ctx, thread.id, after);
  await markThreadRead(env.service, env.ctx.userId, thread.id);
  return NextResponse.json({ ok: true, messages }, { headers: { "Cache-Control": "no-store" } });
}
