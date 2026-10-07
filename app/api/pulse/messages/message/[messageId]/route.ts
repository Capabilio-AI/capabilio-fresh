import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { deleteMessage } from "@/lib/pulse/messages";

/** Delete one of your own messages. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).messageId);
  if (!id.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  return (await deleteMessage(createServiceClient(), auth.userId, id.data)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Message not found." }, { status: 404 });
}
