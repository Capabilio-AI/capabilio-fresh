import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { reviewMentor } from "@/lib/pulse/mentors";

const Body = z.object({ decision: z.enum(["approve", "reject", "suspend"]), note: z.string().trim().max(500).optional() }).strict();

/** Capabilio admins only: approve, reject or suspend a mentor. */
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).userId);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  return (await reviewMentor(createServiceClient(), auth.userId, id.data, body.data.decision, body.data.note ?? null)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Application not found." }, { status: 404 });
}
