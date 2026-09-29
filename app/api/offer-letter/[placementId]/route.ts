import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { can } from "@/lib/org/roles";
import { untyped } from "@/lib/org/db";

const SIGNED_URL_SECONDS = 60;

/**
 * Open an offer letter: allowed for the student it was issued to, and for their college's placement officers.
 * Anyone else gets a 404 (the letter's existence isn't confirmed). The link is short-lived and never stored.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ placementId: string }> }) {
  const { placementId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(placementId)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const { data } = await untyped(service).from("org_placements").select("institution_id, student_user_id, offer_letter_path").eq("id", placementId).maybeSingle();
  const placement = data as { institution_id: string; student_user_id: string; offer_letter_path: string | null } | null;
  if (!placement?.offer_letter_path) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let allowed = placement.student_user_id === auth.user.id;
  if (!allowed) {
    const ctx = await getOrgContext(supabase, auth.user.id);
    allowed = Boolean(ctx && ctx.institutionId === placement.institution_id && (can(ctx, "postPlacement") || can(ctx, "viewOutcomes")));
  }
  if (!allowed) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: signed } = await service.storage.from("org-offers").createSignedUrl(placement.offer_letter_path, SIGNED_URL_SECONDS);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
