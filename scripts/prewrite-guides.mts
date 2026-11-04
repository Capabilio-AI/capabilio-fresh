// One-time (and resumable) backfill: writes the guide and practice data for every active catalogue project that lacks them, so students never wait.
//   set -a; . ./.env.local; set +a; npx tsx --tsconfig tsconfig.json scripts/prewrite-guides.mts [limit] [concurrency]
// Safe to stop and run again: finished projects are skipped, and a project another writer holds is left alone.
import { createServiceClient } from "@/lib/supabase/service";
import { claimWriter } from "@/lib/roadmap-visual/guide-store";
import { loadProjectResource, projectsMissingGuides, writeProjectGuide } from "@/lib/roadmap-visual/guide-writer";

const limit = Number(process.argv[2]) || 1000;
const concurrency = Math.max(1, Number(process.argv[3]) || 3);
const service = createServiceClient();
const ids = await projectsMissingGuides(service, limit);
console.log(`${ids.length} project(s) to write, ${concurrency} at a time`);

let done = 0, failed = 0;
async function worker() {
  for (let id = ids.shift(); id; id = ids.shift()) {
    if ((await claimWriter(service, id)) === "busy") { console.log("busy, skipped", id); continue; }
    const resource = await loadProjectResource(service, id);
    if (!resource) continue;
    const t0 = Date.now();
    try {
      const r = await writeProjectGuide(service, resource, null);
      done++;
      console.log(`ok   ${resource.title.slice(0, 60)} (${Math.round((Date.now() - t0) / 1000)}s${r.data ? "" : ", data pending"}) ${done + failed} done`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${resource.title.slice(0, 60)}: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
console.log(`finished: ${done} written, ${failed} failed`);
