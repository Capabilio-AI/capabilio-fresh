import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { suggestSkillsForImport } from "@/lib/roadmap/extract/suggest-skills";

export const maxDuration = 300;
const CALL_BUDGET_MS = 40_000;

/**
 * The system finishes the analysis of EVERY curriculum itself, live ones included: any course that was read but ended with no skills is read again
 * (at most twice), so a gap is closed by the platform and not left for a student to find. Writes only evidence-checked suggestions; nothing is confirmed
 * on anyone's behalf. Fails closed without CRON_SECRET. Safe to run repeatedly.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = createServiceClient();
  const { data } = await service.from("curriculum_imports").select("id, institution_id").in("status", ["EXTRACTED", "UNDER_REVIEW", "CONFIRMED", "PUBLISHED"]).is("deleted_at", null).order("updated_at", { ascending: false }).limit(60);
  const started = Date.now();
  const report: { importId: string; processed: number; suggested: number; remaining: number }[] = [];
  for (const imp of data ?? []) {
    let processed = 0;
    let suggested = 0;
    let remaining = 0;
    for (let guard = 0; guard < 20 && 270_000 - (Date.now() - started) > CALL_BUDGET_MS; guard++) {
      const r = await suggestSkillsForImport(service, { institutionId: imp.institution_id }, imp.id, { allowPublished: true }).catch((e) => {
        console.error("[curriculum-quality]", imp.id, e instanceof Error ? e.message : e);
        return null;
      });
      if (!r || !r.ok) break;
      processed += r.processed;
      suggested += r.suggested;
      remaining = r.remaining;
      if (r.remaining === 0 || r.processed === 0) break;
    }
    if (processed > 0) report.push({ importId: imp.id, processed, suggested, remaining });
    if (270_000 - (Date.now() - started) <= CALL_BUDGET_MS) break;
  }
  return NextResponse.json({ imports: report.length, report });
}
