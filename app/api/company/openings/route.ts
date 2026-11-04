import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireCompany } from "@/lib/company/gate";
import { OpeningInputSchema } from "@/lib/hiring/schema";
import { slugify } from "@/lib/hiring/format";
import { toColumns } from "@/lib/hiring/openings";

/** Company admins only: post a role. Slugs are global, so a company's slug always carries a short random suffix. */
export async function POST(request: Request) {
  const auth = await requireCompany(await createClient());
  if ("error" in auth) return auth.error;
  const body = OpeningInputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  if (body.data.status === "soon") return NextResponse.json({ error: "Choose draft, open or closed." }, { status: 400 });

  const base = slugify(body.data.title);
  if (base.length < 3) return NextResponse.json({ error: "Give the role a longer title." }, { status: 400 });
  const slug = `${base.slice(0, 70)}-${crypto.randomUUID().slice(0, 6)}`;
  const row = {
    ...toColumns(body.data),
    slug,
    institution_id: auth.ctx.institutionId,
    ...(body.data.status === "open" ? { published_at: new Date().toISOString() } : {}),
  };
  const { data, error } = await untyped(createServiceClient()).from("job_openings").insert(row).select("id").single();
  if (error) {
    console.error("[company] could not create opening:", error.message);
    return NextResponse.json({ error: "Could not save the role." }, { status: 500 });
  }
  revalidatePath("/launchpad");
  return NextResponse.json({ ok: true, id: data.id as string });
}
