import { NextResponse } from "next/server";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

/** For actions open to any signed-in user (follow, like): strict body, session required, service client for the write. */
export async function viewerRoute<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
  handler: (env: { userId: string; service: SupabaseClient<Database> }, body: z.infer<S>) => Promise<NextResponse | Record<string, unknown>>
): Promise<NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const out = await handler({ userId: data.user.id, service: createServiceClient() }, parsed.data);
  return out instanceof NextResponse ? out : NextResponse.json({ ok: true, ...out });
}
