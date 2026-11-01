import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { UpdateVisitSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { normalizeEligibleBranches } from "@/lib/org/branch-scope";
import { describeVisitChanges, type VisitDetails } from "@/lib/org/visits";
import { notify } from "@/lib/notifications/notify";
import { activeStudents, studentsWhoCanRegister } from "@/lib/notifications/audiences";

const COLUMNS = "id, company, role, location, ctc_offered, drive_date, deadline, eligible_branches, eligibility, drive_status";

/**
 * Edit a company visit of the caller's own college. Students who registered are told what changed (dates, place, package, role, branches);
 * if the edit opens the visit to more branches, the students who can now register are told too. A finished or cancelled visit is not editable.
 */
export async function POST(request: Request) {
  return orgRoute(request, UpdateVisitSchema, "postPlacement", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data } = await db.from("opportunities").select(COLUMNS).eq("id", body.opportunityId).eq("institution_id", ctx.institutionId).maybeSingle();
    const before = data as (VisitDetails & { id: string; company: string; drive_status: string }) | null;
    if (!before) return NextResponse.json({ error: "Company visit not found." }, { status: 404 });
    if (before.drive_status === "completed" || before.drive_status === "cancelled") return NextResponse.json({ error: "A finished or cancelled company visit can't be edited." }, { status: 409 });

    const after: VisitDetails = {
      role: body.role ?? before.role,
      location: body.location ?? before.location,
      ctc_offered: body.ctcOffered ?? before.ctc_offered,
      drive_date: body.driveDate ?? before.drive_date,
      deadline: body.deadline ?? before.deadline,
      eligible_branches: body.eligibleBranches === undefined ? before.eligible_branches : normalizeEligibleBranches(body.eligibleBranches),
      eligibility: body.eligibility ?? before.eligibility,
    };
    const { error } = await db.from("opportunities").update(after).eq("id", before.id).eq("institution_id", ctx.institutionId);
    if (error) throw error;

    const changes = describeVisitChanges(before, after);
    if (changes.length === 0) return { changed: 0 };

    const { data: apps } = await service.from("applications").select("user_id").eq("opportunity_id", before.id);
    const registered = new Set((apps ?? []).map((a) => a.user_id));
    const base = { type: "drive_updated", href: "/launchpad", actorId: ctx.userId, institutionId: ctx.institutionId } as const;
    await notify(service, { ...base, userIds: [...registered], title: `${before.company} visit updated`, body: changes.join(" · "), dedupeKey: `drive-update:${before.id}:${randomUUID()}` });

    // an edit that opens the visit to more branches: tell the students who could not register before and can now
    if (before.drive_status === "registration_open" && changes.some((c) => c.startsWith("Open to:"))) {
      const wasOpen = new Set(await activeStudents(service, ctx.institutionId, before.eligible_branches));
      const nowOpen = await studentsWhoCanRegister(service, ctx.institutionId, after.eligible_branches, registered);
      await notify(service, { ...base, type: "drive_open", userIds: nowOpen.filter((id) => !wasOpen.has(id)), title: `${before.company} is now open to your branch`, body: `${after.role}. Register in Launchpad.`, dedupeKey: `drive-open:${before.id}` });
    }
    return { changed: changes.length };
  });
}
