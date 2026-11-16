// Fills Explore roles for each stream, once. For a stream with fewer than 10 stored roles it asks the AI for ~12 entry-level job titles (a mix of
// software/data roles and the branch's own core roles), then matches or builds each role with its skill list through the same pipeline a student's
// typed role uses, and stores the list in stream_roles. A stream that already has 10 or more is left alone: students are served from the database.
//   npm run roles:streams                          dry run: how many roles each stream has
//   npm run roles:streams -- --apply               fill every stream below 10
//   npm run roles:streams -- --apply --stream civil   one stream only (it, ece, eee, mech, civil, other)
import { createServiceClient } from "@/lib/supabase/service";
import { resolveRole } from "@/lib/assess/roles";
import { STREAM_ROLES_ENOUGH, loadStreamRoleIds, proposeStreamTitles, saveStreamRoles } from "@/lib/explore/stream-roles";
import type { Stream } from "@/lib/explore/stream";

const STREAMS: Stream[] = ["ece", "eee", "mech", "civil", "it", "other"];
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const only = args.includes("--stream") ? (args[args.indexOf("--stream") + 1] as Stream) : null;
const service = createServiceClient();
const db = service as never;
const report: { stream: string; had: number; result: string }[] = [];

for (const stream of only ? [only] : STREAMS) {
  const have = await loadStreamRoleIds(service as never, stream);
  if (have.length >= STREAM_ROLES_ENOUGH) { report.push({ stream, had: have.length, result: "enough, skipped" }); continue; }
  if (!apply) { report.push({ stream, had: have.length, result: "would generate" }); continue; }
  try {
    const titles = await proposeStreamTitles(stream);
    const ids = [...have];
    const notes: string[] = [];
    for (const title of titles) {
      try {
        let out = await resolveRole(db, title);
        if (out.status === "CLARIFY") out = await resolveRole(db, title, {}, { kind: "as_typed", title: out.canonicalTitle, industry: "", domain: "" });
        if (out.status !== "MATCHED" && out.status !== "GENERATED") { notes.push(`${title}: ${out.status.toLowerCase()}`); continue; }
        ids.push(out.primary.careerId);
        notes.push(`${out.primary.name} (${out.status === "GENERATED" ? "new" : "existing"})`);
      } catch (e) { notes.push(`${title}: FAILED ${e instanceof Error ? e.message : e}`); }
    }
    await saveStreamRoles(service as never, stream, ids);
    report.push({ stream, had: have.length, result: notes.join("; ") });
  } catch (e) { report.push({ stream, had: have.length, result: `FAILED: ${e instanceof Error ? e.message : e}` }); }
}
console.table(report);
