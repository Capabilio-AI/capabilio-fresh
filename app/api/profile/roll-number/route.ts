import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { RollNumberSchema } from "@/lib/org/roll-number";

/** A student adds or corrects their own roll number. The database re-checks it against their college's code on write. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = RollNumberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid roll number." }, { status: 400 });

  const service = createServiceClient();
  const { data: membership } = await service
    .from("institution_memberships")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("role", "student")
    .eq("status", "active")
    .not("branch", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No college membership found." }, { status: 404 });

  const { data, error } = await service.from("institution_memberships").update({ roll_number: parsed.data.rollNumber }).eq("id", membership.id).select("roll_number_status").single();
  if (error) {
    console.error("roll-number update failed", error);
    return NextResponse.json({ error: "Could not save your roll number." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: data.roll_number_status });
}
