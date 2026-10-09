import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { listConnections } from "@/lib/pulse/connections";

const Query = z.object({ userId: z.string().uuid(), type: z.enum(["followers", "following"]) });

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const parsed = Query.safeParse({ userId: (await params).userId, type: new URL(request.url).searchParams.get("type") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  return NextResponse.json(await listConnections(createServiceClient(), auth.userId, parsed.data.userId, parsed.data.type));
}
