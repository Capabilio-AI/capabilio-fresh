import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStage } from "@/lib/stage/guard";
import { studentHasRole } from "@/lib/careers/has-role";
import { getStudentDirection } from "@/lib/career/direction";
import { studentPhase } from "@/lib/student/phase";
import { streamOf, STREAM_SUGGESTIONS } from "@/lib/explore/stream";
import { STREAM_ROLES_ENOUGH, loadStreamRoleIds } from "@/lib/explore/stream-roles";
import { loadRoleOptions } from "@/lib/assess/roles";
import type { Db } from "@/lib/assess/db";
import { ExploreRoles } from "@/components/explore/ExploreRoles";

export const metadata: Metadata = { title: "Explore roles — Capabilio AI" };

/** A student who has not chosen a role looks at the roles here: what each one is about and which skills it needs. Once they have chosen, this page has nothing for them. */
export default async function ExplorePage() {
  await requireStage(["student"]);
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  if (await studentHasRole(service, user.id)) redirect("/dashboard");
  const [roles, direction] = await Promise.all([loadRoleOptions(service as unknown as Db), getStudentDirection(service, user.id)]);
  const phase = studentPhase(direction?.academicYear?.year ?? null, false);
  const stream = streamOf(direction?.branch ?? null);
  const sug = STREAM_SUGGESTIONS[stream];
  const byName = new Map(roles.map((r) => [r.name.toLowerCase(), r]));
  const byId = new Map(roles.map((r) => [r.careerId, r]));
  // The stream's own list comes from the database once it has been generated; until then the built-in suggestions stand in for it.
  const stored = (await loadStreamRoleIds(service, stream)).map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
  const useStored = stored.length >= STREAM_ROLES_ENOUGH; // a part-filled list is worse than the built-in one, so it waits until it is complete
  const suggested = useStored ? stored : sug.roles.map((n) => byName.get(n.toLowerCase())).filter((r): r is NonNullable<typeof r> => !!r);
  return <ExploreRoles roles={roles} required={phase === "choose"} stream={{ label: sug.label, branch: direction?.branch ?? null, known: stream !== "other", suggested, extra: useStored ? [] : sug.extra }} />;
}
