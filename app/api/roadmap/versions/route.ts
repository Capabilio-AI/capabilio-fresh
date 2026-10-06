import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { listRoadmapVersions } from "@/lib/roadmap-engine/read";

/** Every version of every roadmap the signed-in student has had, newest first. Old versions are never deleted. */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json({ versions: await listRoadmapVersions(createServiceClient(), auth.userId) });
}
