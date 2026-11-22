import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { STREAM_SUGGESTIONS } from "@/lib/explore/stream";
import { loadRoleRows } from "@/lib/courses/roles-db";
import { AreaRoles } from "@/components/courses/AreaRoles";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "IT skills | SkillStudio | Capabilio AI" };

/** IT roles: software, data, cloud, security and AI. Open to every branch. */
export default async function ItCoursesPage() {
  await requireAuthedUser();
  let rows: Awaited<ReturnType<typeof loadRoleRows>> = [];
  try { rows = await loadRoleRows(createServiceClient()); } catch (e) { console.error("[courses/it] roles unavailable:", e instanceof Error ? e.message : e); }
  return <AreaRoles title="IT skills" intro="Software, data, cloud, security and AI. Every branch can learn these, and most companies hire for them." suggestion={STREAM_SUGGESTIONS.it} rows={rows} languageKey="it" />;
}
