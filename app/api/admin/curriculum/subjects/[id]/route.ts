import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { deleteSubject } from "@/lib/roadmap/curriculum-writes";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;

  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await deleteSubject(createServiceClient(), admin.institutionId, id.data);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}
