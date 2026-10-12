import { orgRoute } from "@/lib/api/org-route";
import { CalendarEntrySchema, saveCalendarEntry } from "@/lib/org/academic-calendar";

/** A semester start date for a branch and year (or all). The institution comes from the caller's membership, never the body. */
export async function POST(request: Request) {
  return orgRoute(request, CalendarEntrySchema, "manageCalendar", async ({ ctx, service }, body) => {
    await saveCalendarEntry(service, ctx.institutionId, ctx.userId, body);
    return {};
  });
}
