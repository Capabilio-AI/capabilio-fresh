import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { enrichImport } from "@/lib/roadmap/extract/derive";

export const maxDuration = 300;
const MAX_IMPORTS = 3;

/** Daily safety net: continues the analysis of any unpublished curriculum that was left unfinished (for example after a closed browser tab). Fails closed without CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = createServiceClient();
  const { data } = await untyped(service).from("curriculum_imports").select("id, institution_id, enrichment").in("status", ["EXTRACTED", "UNDER_REVIEW", "CONFIRMED"]).is("deleted_at", null).order("updated_at", { ascending: false }).limit(25);
  const open = ((data ?? []) as { id: string; institution_id: string; enrichment: { state?: string } | null }[]).filter((i) => i.enrichment?.state === "RUNNING").slice(0, MAX_IMPORTS);
  const started = Date.now();
  let continued = 0;
  for (const i of open) {
    const budget = 270_000 - (Date.now() - started);
    if (budget < 30_000) break;
    await enrichImport(service, i.id, { institutionId: i.institution_id }, { budgetMs: budget }).catch((e) => console.error("[curriculum-enrich cron]", e instanceof Error ? e.message : e));
    continued++;
  }
  return NextResponse.json({ continued });
}
