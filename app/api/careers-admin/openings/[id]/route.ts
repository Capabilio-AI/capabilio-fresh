import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { OpeningPatchSchema } from "@/lib/hiring/schema";
import { toColumns } from "@/lib/hiring/openings";

/** Capabilio admins only: edit a role, or open / close it. The first time a role opens it gets its posted date; reopening keeps the original. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  const body = OpeningPatchSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: body.success ? "Invalid request." : (body.error.issues[0]?.message ?? "Invalid request.") }, { status: 400 });

  const db = untyped(createServiceClient());
  const { data: current } = await db.from("job_openings").select("slug, published_at").eq("id", id.data).maybeSingle();
  if (!current) return NextResponse.json({ error: "Role not found." }, { status: 404 });

  const patch = {
    ...toColumns(body.data),
    updated_at: new Date().toISOString(),
    ...(body.data.status === "open" && !current.published_at ? { published_at: new Date().toISOString() } : {}),
  };
  const { error } = await db.from("job_openings").update(patch).eq("id", id.data);
  if (error?.code === "23505") return NextResponse.json({ error: "Another role already uses that link name." }, { status: 409 });
  if (error) {
    console.error("[careers-admin] could not update opening:", error.message);
    return NextResponse.json({ error: "Could not save the role." }, { status: 500 });
  }
  revalidatePath("/careers");
  revalidatePath(`/careers/${current.slug as string}`);
  return NextResponse.json({ ok: true });
}
