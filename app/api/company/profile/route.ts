import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireCompany } from "@/lib/company/gate";
import { CompanyProfileInputSchema, splitProfile } from "@/lib/company/profile-schema";

/**
 * Company admins only: save THEIR OWN public page. Logo and cover are not here (the upload route sets them), and the target is always the caller's
 * institution, never a request field. Three small writes, each an upsert or update of columns this route owns.
 */
export async function POST(request: Request) {
  const auth = await requireCompany(await createClient());
  if ("error" in auth) return auth.error;
  const body = CompanyProfileInputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const { institutionId, institutionSlug } = auth.ctx;
  const parts = splitProfile(body.data);
  const service = createServiceClient();
  const db = untyped(service);

  const [org, company, city] = await Promise.all([
    db.from("org_profiles").upsert({ institution_id: institutionId, ...parts.org }),
    db.from("company_profiles").upsert({ institution_id: institutionId, ...parts.company }),
    service.from("institutions").update({ city: parts.city }).eq("id", institutionId),
  ]);
  const failed = org.error ?? company.error ?? city.error;
  if (failed) {
    console.error("[company] could not save profile:", failed.message);
    return NextResponse.json({ error: "Could not save your profile. Please try again." }, { status: 500 });
  }
  revalidatePath(`/c/${institutionSlug}`);
  return NextResponse.json({ ok: true });
}
