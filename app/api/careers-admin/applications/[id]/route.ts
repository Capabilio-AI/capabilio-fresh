import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { ApplicationPatchSchema } from "@/lib/hiring/schema";

/** Capabilio admins only: move an application along and keep a private note on it. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  const body = ApplicationPatchSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const patch = {
    ...(body.data.status !== undefined ? { status: body.data.status } : {}),
    ...(body.data.internalNote !== undefined ? { internal_note: body.data.internalNote || null } : {}),
  };
  const { data, error } = await untyped(createServiceClient()).from("job_applications").update(patch).eq("id", id.data).select("id").maybeSingle();
  if (error) {
    console.error("[careers-admin] could not update application:", error.message);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return data ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Application not found." }, { status: 404 });
}
