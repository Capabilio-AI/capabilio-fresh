import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { suggestPages, suggestPeople, trendingTags } from "@/lib/pulse/sidebar";

export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const service = createServiceClient();
  const [trending, suggestions, pages] = await Promise.all([trendingTags(service), suggestPeople(service, auth.userId), suggestPages(service, auth.userId)]);
  return NextResponse.json({ trending, suggestions, pages });
}
