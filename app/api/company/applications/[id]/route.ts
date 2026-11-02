import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireCompany } from "@/lib/company/gate";
import { ApplicationPatchSchema } from "@/lib/hiring/schema";

/** Company admins only: move an application to THEIR OWN role along and keep a private note on it. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCompany(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  const body = ApplicationPatchSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const db = untyped(createServiceClient());
  // the application must belong to a role this company owns
  const { data: owned } = await db.from("job_applications").select("id, job_openings!inner(institution_id)").eq("id", id.data).eq("job_openings.institution_id", auth.ctx.institutionId).maybeSingle();
  if (!owned) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const patch = {
    ...(body.data.status !== undefined ? { status: body.data.status } : {}),
    ...(body.data.internalNote !== undefined ? { internal_note: body.data.internalNote || null } : {}),
  };
  const { error } = await db.from("job_applications").update(patch).eq("id", id.data);
  if (error) {
    console.error("[company] could not update application:", error.message);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
