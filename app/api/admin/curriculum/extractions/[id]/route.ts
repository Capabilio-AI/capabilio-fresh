import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { deleteExtraction, getExtraction } from "@/lib/roadmap/extract/store";

async function authorised(params: Promise<{ id: string }>) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return { error: admin.error };
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return { error: NextResponse.json({ error: "Invalid request." }, { status: 400 }) };
  return { admin, id: id.data };
}

/** Status (and, once ready, the staged candidates). Scoped to the caller's institution and their own upload. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorised(params);
  if ("error" in a) return a.error;
  const record = await getExtraction(createServiceClient(), a.admin.institutionId, a.admin.userId, a.id);
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ extraction: record });
}

/** Discard the staged result (after the admin confirms, or to throw it away). Writes nothing to curriculum tables. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorised(params);
  if ("error" in a) return a.error;
  const ok = await deleteExtraction(createServiceClient(), a.admin.institutionId, a.admin.userId, a.id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
