import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { untyped } from "@/lib/org/db";

const Body = z.object({ status: z.enum(["reviewed", "dismissed", "open"]) }).strict();

/** Capabilio admins only: mark a report reviewed or dismissed. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { data, error } = await untyped(createServiceClient()).from("pulse_reports").update({ status: body.data.status }).eq("id", id.data).select("id");
  return !error && (data?.length ?? 0) > 0 ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Report not found." }, { status: 404 });
}
