import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { listConversations, sendMessage, MAX_BODY } from "@/lib/pulse/messages";

const SendSchema = z.object({ userId: z.string().uuid(), body: z.string().max(MAX_BODY * 2) }).strict();

/** The caller's conversations (and unread totals). */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const service = createServiceClient();
  const conversations = await listConversations(service, auth.userId);
  return NextResponse.json({
    conversations,
    summary: { unread: conversations.filter((c) => c.status === "accepted").reduce((n, c) => n + c.unread, 0), requests: conversations.filter((c) => c.incomingRequest).length },
  });
}

/** Send a message to a person. The first one to someone who doesn't follow you becomes a request. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "dm_send", maxRequests: 90, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = SendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message." }, { status: 400 });
  const result = await sendMessage(createServiceClient(), auth.userId, parsed.data.userId, parsed.data.body);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, conversationId: result.conversationId, status: result.status, message: result.message }, { status: 201 });
}

