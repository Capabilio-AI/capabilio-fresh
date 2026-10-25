import { orgRoute } from "@/lib/api/org-route";
import { NextResponse } from "next/server";
import { CalendarEntrySchema, saveCalendarEntry } from "@/lib/org/academic-calendar";
import { calendarScope, resolveCalendarBranch } from "@/lib/org/branch-scope";

/**
 * A semester start date for a branch and year (or all). The institution comes from the caller's membership, never the body. Admins and anyone granted
 * "College page" may set any branch; an HOD (or other branch-scoped staff) only their own.
 */
export async function POST(request: Request) {
  return orgRoute(request, CalendarEntrySchema, "manageCalendar", async ({ ctx, service }, body) => {
    const scope = calendarScope(ctx);
    if (!scope.ok) return NextResponse.json({ error: scope.message }, { status: 403 });
    const branch = resolveCalendarBranch(scope.scope, body.branch);
    if (!branch.ok) return NextResponse.json({ error: branch.message }, { status: 403 });
    await saveCalendarEntry(service, ctx.institutionId, ctx.userId, { ...body, branch: branch.value });
    return {};
  });
}
