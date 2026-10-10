import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { loadCareerContext } from "@/lib/pulse/career-context";
import { loadCareerNews, loadTrendingNews } from "@/lib/pulse/news";

/** Technical news for the viewer's own career, so a student with no career goal gets none rather than random headlines. */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const service = createServiceClient();
  const ctx = await loadCareerContext(service, auth.userId);
  const [items, trending] = await Promise.all([loadCareerNews(service, ctx), loadTrendingNews(service)]);
  return NextResponse.json({ role: ctx.roles[0] ?? null, items, trending });
}
