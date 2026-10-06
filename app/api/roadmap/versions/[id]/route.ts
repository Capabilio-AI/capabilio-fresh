import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getRoadmapVersionView } from "@/lib/roadmap-engine/read";

/** One historical version — only if it belongs to the signed-in student. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const view = await getRoadmapVersionView(createServiceClient(), auth.userId, id.data);
  return view ? NextResponse.json({ roadmap: view }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
