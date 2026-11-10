import { NextResponse } from "next/server";
import { authorizeOrg } from "@/lib/api/org-route";
import { loadCrtOverview } from "@/lib/crt/org";
import { resultsCsv } from "@/lib/crt/aggregate";

/** CSV of one cycle's results for the placement cell: every eligible student, with who has not taken it. */
export async function GET(request: Request) {
  const env = await authorizeOrg("viewOutcomes");
  if (env instanceof NextResponse) return env;
  const cycleId = new URL(request.url).searchParams.get("cycle");
  const overview = await loadCrtOverview(env.service, env.ctx.institutionId, cycleId);
  if (!overview.selected || (cycleId && overview.selected.cycle.id !== cycleId)) return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
  const slug = overview.selected.cycle.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "crt";
  return new NextResponse(resultsCsv(overview.selected.rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="crt-${slug}.csv"`, "cache-control": "no-store" },
  });
}
