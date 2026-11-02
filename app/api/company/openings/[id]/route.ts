import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireCompany } from "@/lib/company/gate";
import { OpeningPatchSchema } from "@/lib/hiring/schema";
import { toColumns } from "@/lib/hiring/openings";

/** Company admins only: edit, open or close one of THEIR OWN roles. The slug is never editable (it is not in the patch). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCompany(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  const body = OpeningPatchSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: body.success ? "Invalid request." : (body.error.issues[0]?.message ?? "Invalid request.") }, { status: 400 });
  if (body.data.status === "soon") return NextResponse.json({ error: "Choose draft, open or closed." }, { status: 400 });

  const db = untyped(createServiceClient());
  const { data: current } = await db.from("job_openings").select("published_at").eq("id", id.data).eq("institution_id", auth.ctx.institutionId).maybeSingle();
  if (!current) return NextResponse.json({ error: "Role not found." }, { status: 404 });

  const { slug: _ignored, ...fields } = toColumns(body.data);
  void _ignored;
  const patch = {
    ...fields,
    updated_at: new Date().toISOString(),
    ...(body.data.status === "open" && !current.published_at ? { published_at: new Date().toISOString() } : {}),
  };
  const { error } = await db.from("job_openings").update(patch).eq("id", id.data).eq("institution_id", auth.ctx.institutionId);
  if (error) {
    console.error("[company] could not update opening:", error.message);
    return NextResponse.json({ error: "Could not save the role." }, { status: 500 });
  }
  revalidatePath("/jobs");
  return NextResponse.json({ ok: true });
}
