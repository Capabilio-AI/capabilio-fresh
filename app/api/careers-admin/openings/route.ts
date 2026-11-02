import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { OpeningInputSchema } from "@/lib/hiring/schema";
import { slugify } from "@/lib/hiring/format";
import { toColumns } from "@/lib/hiring/openings";

/** Capabilio admins only: post a new role. Open roles go live on /careers at once; drafts stay private. */
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const body = OpeningInputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const slug = body.data.slug ?? slugify(body.data.title);
  if (slug.length < 3) return NextResponse.json({ error: "Give the role a longer title or link name." }, { status: 400 });
  const row = { ...toColumns(body.data), slug, ...(body.data.status === "open" ? { published_at: new Date().toISOString() } : {}) };

  const { data, error } = await untyped(createServiceClient()).from("job_openings").insert(row).select("id").single();
  if (error?.code === "23505") return NextResponse.json({ error: "Another role already uses that link name." }, { status: 409 });
  if (error) {
    console.error("[careers-admin] could not create opening:", error.message);
    return NextResponse.json({ error: "Could not save the role." }, { status: 500 });
  }
  revalidatePath("/careers");
  return NextResponse.json({ ok: true, id: data.id as string });
}
