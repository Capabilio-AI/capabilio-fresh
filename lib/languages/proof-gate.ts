import type { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { studentOnlyResponse } from "@/lib/stage/guard";

/** The shared door of the tier-proof routes: a signed-in student, with the service client the routes read and write through. */
export async function proofGate(): Promise<{ error: NextResponse } | { userId: string; service: ReturnType<typeof createServiceClient> }> {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return { error: auth.error };
  const notStudent = await studentOnlyResponse(auth.userId);
  if (notStudent) return { error: notStudent };
  return { userId: auth.userId, service: createServiceClient() };
}
