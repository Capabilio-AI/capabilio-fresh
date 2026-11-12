import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireCompany } from "@/lib/company/gate";
import { RespondSchema } from "@/lib/org/requests";
import { getOrCreateThread, staffToNotify } from "@/lib/org/threads";
import { notify } from "@/lib/notifications/notify";

/** A company accepts or declines a college's invitation. Only the company the invitation was addressed to can answer, and only once. */
export async function POST(request: Request) {
  const auth = await requireCompany(await createClient());
  if ("error" in auth) return auth.error;
  const body = RespondSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { ctx } = auth;
  const service = createServiceClient();
  const { data, error } = await untyped(service)
    .from("campus_visit_requests")
    .update({ status: body.data.decision === "accept" ? "accepted" : "declined", response_note: body.data.note || null, responded_by: ctx.userId, responded_at: new Date().toISOString() })
    .eq("id", body.data.id)
    .eq("company_id", ctx.institutionId)
    .eq("status", "pending")
    .select("college_id, role");
  if (error) {
    console.error("[company] could not answer request:", error.message);
    return NextResponse.json({ error: "Could not save your reply. Please try again." }, { status: 500 });
  }
  const row = (data as { college_id: string; role: string }[] | null)?.[0];
  if (!row) return NextResponse.json({ error: "That invitation was already answered or withdrawn." }, { status: 409 });
  // an accepted invitation opens the conversation, so Messages is not empty
  if (body.data.decision === "accept") await getOrCreateThread(service, ctx, row.college_id).catch((e) => console.error("[company] could not open thread:", e));
  await notify(service, {
    userIds: await staffToNotify(service, row.college_id, "college"),
    type: "visit_request_reply",
    title: `${ctx.institutionName} ${body.data.decision === "accept" ? "accepted" : "declined"} your invitation`,
    body: row.role,
    href: "/org/companies",
    actorId: ctx.userId,
    institutionId: row.college_id,
    dedupeKey: `visit-reply:${body.data.id}`,
  });
  return NextResponse.json({ ok: true });
}
