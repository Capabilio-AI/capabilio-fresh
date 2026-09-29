import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { MappingBodySchema } from "@/lib/roadmap/schemas";
import { setMapping } from "@/lib/roadmap/curriculum-writes";

/** The admin's explicit confirmation: this is the only way a subject→skill-area mapping is ever stored. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;

  const id = z.string().uuid().safeParse((await params).id);
  const parsed = MappingBodySchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await setMapping(createServiceClient(), admin, id.data, parsed.data.roleKey, parsed.data.areaKeys, parsed.data.fromSuggestion);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}
