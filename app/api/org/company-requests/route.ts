import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { untyped } from "@/lib/org/db";
import { NewRequestSchema } from "@/lib/org/requests";
import { staffToNotify } from "@/lib/org/threads";
import { notify } from "@/lib/notifications/notify";

/** A college invites an approved company to visit. The college is the caller's own; the company must be an approved company. */
export async function POST(request: Request) {
  return orgRoute(request, NewRequestSchema, "postPlacement", async ({ ctx, service }, body) => {
    if (ctx.kind === "company") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const db = untyped(service);
    const { data: admin } = await db.from("institution_memberships").select("id").eq("institution_id", body.companyId).eq("role", "company_admin").eq("status", "active").order("id").limit(1).maybeSingle();
    if (!admin) return NextResponse.json({ error: "That company isn't on Capabilio yet." }, { status: 404 });
    const { data, error } = await db
      .from("campus_visit_requests")
      .insert({ college_id: ctx.institutionId, company_id: body.companyId, role: body.role, proposed_date: body.proposedDate ?? null, location: body.location || null, message: body.message, created_by: ctx.userId })
      .select("id")
      .single();
    if (error?.code === "23505") return NextResponse.json({ error: "You already have an open invitation to this company. Wait for their reply or cancel it." }, { status: 409 });
    if (error) throw error;
    await notify(service, {
      userIds: await staffToNotify(service, body.companyId, "company"),
      type: "visit_request",
      title: `${ctx.institutionName} invited you to visit`,
      body: body.role,
      href: "/company/requests",
      actorId: ctx.userId,
      institutionId: body.companyId,
      dedupeKey: `visit-request:${(data as { id: string }).id}`,
    });
    return { id: (data as { id: string }).id };
  });
}
