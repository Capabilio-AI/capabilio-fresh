import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import { requireUser } from "@/lib/api/require-user";
import { getCommunityBySlug, type Access, type CommunityRow, type CommunitySummary } from "./communities";

export interface CommunityEnv {
  userId: string;
  service: SupabaseClient<Database>;
  community: CommunityRow;
  summary: CommunitySummary;
  access: Access;
}

/** Shared gate for /api/pulse/communities/[slug]/...: signed in, and the community is one this person may see (else 404, never a hint it exists). */
export async function withCommunity(params: Promise<{ slug: string }>, handler: (env: CommunityEnv) => Promise<NextResponse>): Promise<NextResponse> {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,70}$/.test(slug)) return NextResponse.json({ error: "Community not found." }, { status: 404 });
  const service = createServiceClient();
  const found = await getCommunityBySlug(service, auth.userId, slug);
  if (!found) return NextResponse.json({ error: "Community not found." }, { status: 404 });
  return handler({ userId: auth.userId, service, ...found });
}
