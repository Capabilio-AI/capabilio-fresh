import { getVerifiedUser } from "@/lib/supabase/aal";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { can } from "@/lib/org/roles";
import { untyped } from "@/lib/org/db";
import { registrationsToCsv, type RegistrationRow } from "@/lib/org/visits";
import { loadRegistrantProof } from "@/lib/org/registrations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** CSV of the students registered for ONE company visit of the caller's own college (TPO / admin: whoever may post placements). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx || !can(ctx, "postPlacement")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const visitId = new URL(request.url).searchParams.get("visit") ?? "";
  if (!UUID.test(visitId)) return NextResponse.json({ error: "Missing or invalid visit." }, { status: 400 });

  const service = createServiceClient();
  const { data: visit } = await untyped(service).from("opportunities").select("id, company").eq("id", visitId).eq("institution_id", ctx.institutionId).maybeSingle();
  if (!visit) return NextResponse.json({ error: "Company visit not found." }, { status: 404 });

  const { data: apps, error } = await service.from("applications").select("user_id, status, applied_at").eq("opportunity_id", visitId).order("applied_at").limit(5000);
  if (error) throw error;
  const ids = (apps ?? []).map((a) => a.user_id);
  const [profiles, members] = await Promise.all([
    ids.length ? service.from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? untyped(service).from("institution_memberships").select("user_id, branch, end_year, roll_number").eq("institution_id", ctx.institutionId).in("user_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const proof = await loadRegistrantProof(service, ids);
  const profile = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const member = new Map(((members.data ?? []) as { user_id: string; branch: string | null; end_year: number | null; roll_number: string | null }[]).map((m) => [m.user_id, m]));
  const rows: RegistrationRow[] = (apps ?? []).map((a) => ({
    studentName: profile.get(a.user_id)?.full_name ?? "Student",
    rollNumber: member.get(a.user_id)?.roll_number ?? null,
    branch: member.get(a.user_id)?.branch ?? null,
    endYear: member.get(a.user_id)?.end_year ?? null,
    email: profile.get(a.user_id)?.email ?? null,
    status: a.status,
    registeredOn: a.applied_at,
    targetRole: proof.get(a.user_id)?.targetRole ?? null,
    elo: proof.get(a.user_id)?.elo ?? null,
    passportUrl: proof.get(a.user_id)?.passportUrl ?? null,
  }));
  const slug = String((visit as { company: string }).company).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "visit";
  return new NextResponse(registrationsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registered-${slug}-${ctx.institutionSlug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
