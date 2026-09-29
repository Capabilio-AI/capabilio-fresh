import { NextResponse } from "next/server";
import { z } from "zod";
import { orgRoute } from "@/lib/api/org-route";
import { listChatMembers } from "@/lib/org/chat";
import { untyped } from "@/lib/org/db";

const CreateSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(200).optional(),
    isPrivate: z.boolean().default(false),
    memberUserIds: z.array(z.string().uuid()).max(200).default([]),
  })
  .strict();

/** Create a channel. A private one lists its members; only people who hold the chat permission at THIS college can be added. */
export async function POST(request: Request) {
  return orgRoute(request, CreateSchema, "useChat", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const eligible = new Set((await listChatMembers(service, ctx)).map((m) => m.userId));
    const members = [...new Set(body.memberUserIds)].filter((id) => eligible.has(id));
    if (body.isPrivate && members.length === 0) return NextResponse.json({ error: "Add at least one other person to a private channel." }, { status: 400 });

    const { data, error } = await db
      .from("org_chat_channels")
      .insert({ institution_id: ctx.institutionId, name: body.name, description: body.description || null, is_private: body.isPrivate, created_by_membership_id: ctx.membershipId })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "A channel with that name already exists." }, { status: 409 });
      throw error;
    }
    const channelId = (data as { id: string }).id;
    if (body.isPrivate) {
      const { error: memberError } = await db.from("org_chat_channel_members").insert([ctx.userId, ...members].map((userId) => ({ channel_id: channelId, user_id: userId })));
      if (memberError) throw memberError;
    }
    return { channelId };
  });
}
