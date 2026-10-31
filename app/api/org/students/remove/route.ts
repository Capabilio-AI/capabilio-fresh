import { NextResponse } from "next/server";
import { z } from "zod";
import { orgRoute } from "@/lib/api/org-route";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";

const Schema = z.object({ userId: z.string().uuid() }).strict();

/** Remove a student from this college. Their account and work stay theirs; they just stop being counted and listed here. */
export async function POST(request: Request) {
  return orgRoute(request, Schema, "approveMembers", async ({ ctx, service }, body) => {
    const { data, error } = await untyped(service)
      .from("institution_memberships")
      .update({ status: "revoked" })
      .eq("institution_id", ctx.institutionId)
      .eq("user_id", body.userId)
      .eq("role", "student")
      .eq("status", "active")
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    await notify(service, {
      userIds: [body.userId],
      type: "student_removed",
      title: `You were removed from ${ctx.institutionName}`,
      body: "Your account and your work stay with you. You can join a college again from your settings.",
      href: "/settings",
      actorId: ctx.userId,
      institutionId: ctx.institutionId,
      dedupeKey: `student-removed:${ctx.institutionId}:${body.userId}:${new Date().toISOString().slice(0, 10)}`,
    });
    return {};
  });
}
