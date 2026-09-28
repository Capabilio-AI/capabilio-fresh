import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";

const VALID_YEARS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2", "4-1", "4-2"] as const;

const BodySchema = z.object({
  membershipId: z.string().uuid().optional(),
  collegeName: z.string().trim().min(2).max(200),
  branch: z.string().trim().max(200).optional(),
  year: z.enum(VALID_YEARS).optional(),
});

/**
 * Lets a student add or correct entries in their educational history —
 * previously this was only ever set once, by a DB trigger, at signup, and
 * only as a single record. A student can now add more than one entry
 * (e.g. a previous school plus their current college) — the DB already
 * allowed multiple institution_memberships rows per user (unique on
 * user_id+institution_id, never on user_id alone); only this route used
 * to assume a single row. Passing membershipId edits that specific entry;
 * omitting it always creates a new one. Uses the service client because
 * get_or_create_institution() is only granted to service_role (by
 * design — it's the same institution-dedup logic the signup trigger uses,
 * not something a client should call with an arbitrary string without the
 * dedup guarantee being enforced server-side).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { membershipId, collegeName, branch, year } = parsed.data;

  const service = createServiceClient();

  const { data: institutionId, error: institutionError } = await service.rpc("get_or_create_institution", {
    institution_name: collegeName,
  });
  if (institutionError || !institutionId) {
    return NextResponse.json({ error: "Could not resolve institution." }, { status: 500 });
  }

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
    const { error } = await service
      .from("institution_memberships")
      .update({ institution_id: institutionId, branch: branch ?? null, year: year ?? null })
      .eq("id", membershipId);
    if (error) return NextResponse.json({ error: "Could not update entry." }, { status: 500 });
    return NextResponse.json({ membershipId });
  }

  const { data: profile } = await service.from("profiles").select("primary_role").eq("id", auth.userId).single();

  const { data: inserted, error } = await service
    .from("institution_memberships")
    .insert({
      user_id: auth.userId,
      institution_id: institutionId,
      role: profile?.primary_role ?? "student",
      branch: branch ?? null,
      year: year ?? null,
    })
    .select("id")
    .single();
  if (error || !inserted) return NextResponse.json({ error: "Could not save entry." }, { status: 500 });

  return NextResponse.json({ membershipId: inserted.id });
}
