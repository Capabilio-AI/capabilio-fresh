import { NextResponse } from "next/server";
import { authorizeOrg, type RouteEnv } from "@/lib/api/org-route";
import { requireCompany } from "@/lib/company/gate";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Either side of a college-company conversation: an approved company, or a college member who handles company visits. */
export async function authorizeParty(): Promise<RouteEnv | NextResponse> {
  const supabase = await createClient();
  const company = await requireCompany(supabase);
  if (!("error" in company)) return { ctx: company.ctx, supabase, service: createServiceClient() };
  return authorizeOrg("postPlacement");
}
