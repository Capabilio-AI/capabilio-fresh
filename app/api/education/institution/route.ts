import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";

const CURRENT_YEAR = new Date().getFullYear();

const BodySchema = z
  .object({
    membershipId: z.string().uuid().optional(),
    collegeName: z.string().trim().min(2).max(200),
    degree: z.string().trim().max(200).optional(),
    fieldOfStudy: z.string().trim().max(200).optional(),
    startYear: z.number().int().min(1980).max(CURRENT_YEAR + 10).optional(),
    endYear: z.number().int().min(1980).max(CURRENT_YEAR + 10).optional(),
  })
  .refine((v) => !v.startYear || !v.endYear || v.endYear >= v.startYear, {
    message: "End year must be on or after the start year.",
    path: ["endYear"],
  });

/**
 * Lets a student add or correct entries in their educational history —
 * previously this was only ever set once, by a DB trigger, at signup, and
 * only as a single record shaped for an ongoing B.Tech (branch + semester
 * `year`). A student can now add more than one entry across every stage of
 * Indian education (10th, Intermediate, B.Tech, M.Tech/MSc — same as
 * LinkedIn's Education section), described by degree/fieldOfStudy/
 * startYear/endYear instead. The DB already allowed multiple
 * institution_memberships rows per user (unique on user_id+institution_id,
 * never on user_id alone); only this route used to assume a single row.
 * Passing membershipId edits that specific entry (leaving its legacy
 * branch/year columns untouched); omitting it always creates a new one.
 * Uses the service client because get_or_create_institution() is only
 * granted to service_role (by design — it's the same institution-dedup
 * logic the signup trigger uses, not something a client should call with
 * an arbitrary string without the dedup guarantee enforced server-side).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { membershipId, collegeName, degree, fieldOfStudy, startYear, endYear } = parsed.data;

  const service = createServiceClient();

  const { data: institutionId, error: institutionError } = await service.rpc("get_or_create_institution", {
    institution_name: collegeName,
  });
  if (institutionError || !institutionId) {
    return NextResponse.json({ error: "Could not resolve institution." }, { status: 500 });
  }

  const fields = {
    institution_id: institutionId,
    degree: degree ?? null,
    field_of_study: fieldOfStudy ?? null,
    start_year: startYear ?? null,
    end_year: endYear ?? null,
  };

  if (membershipId) {
    const { data: existing } = await service
      .from("institution_memberships")
      .select("id")
      .eq("id", membershipId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }
    const { error } = await service.from("institution_memberships").update(fields).eq("id", membershipId);
    if (error) return NextResponse.json({ error: "Could not update entry." }, { status: 500 });
    return NextResponse.json({ membershipId });
  }

  const { data: profile } = await service.from("profiles").select("primary_role").eq("id", auth.userId).single();

  const { data: inserted, error } = await service
    .from("institution_memberships")
    .insert({ user_id: auth.userId, role: profile?.primary_role ?? "student", ...fields })
    .select("id")
    .single();
  if (error || !inserted) return NextResponse.json({ error: "Could not save entry." }, { status: 500 });

  return NextResponse.json({ membershipId: inserted.id });
}
