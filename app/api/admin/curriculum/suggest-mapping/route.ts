import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { SuggestBodySchema } from "@/lib/roadmap/schemas";
import { suggestAreasForSubject } from "@/lib/roadmap/suggest";
import { loadRoleTaxonomy } from "@/lib/arena-workstations/taxonomy";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";

/** PROPOSES a mapping for the admin to review. Never writes to the database. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;

  const limit = await checkRateLimit(admin.userId, { bucket: "curriculum_suggest", maxRequests: 30, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const parsed = SuggestBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const { role, areas } = await loadRoleTaxonomy(createServiceClient(), parsed.data.roleKey);
    const enabled = areas.filter((a) => a.enabled).map((a) => ({ key: a.area_key, name: a.display_name }));
    const suggested = await suggestAreasForSubject(parsed.data.subjectName, role.display_name, enabled);
    return NextResponse.json({ suggestedAreaKeys: suggested });
  } catch {
    return NextResponse.json({ error: "Could not get a suggestion right now — you can still map it by hand." }, { status: 502 });
  }
}
