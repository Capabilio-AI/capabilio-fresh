/**
 * Authoring CLI for any-goal pathways (docs/any-goal-pathways-design.md). Nothing here makes a pathway live by itself.
 *   npm run pathway:content -- validate <file>...            check a pathway file against every rule; writes nothing
 *   npm run pathway:content -- import <file>...              validate, then save as a DRAFT version
 *   npm run pathway:content -- review <id> --as <email>      a Capabilio admin reviews a draft (the reviewer is recorded)
 *   npm run pathway:content -- publish <id>                  REVIEWED -> PUBLISHED (refused if any fact has expired)
 *   npm run pathway:content -- retire <id> | list
 * Every date, limit, fee and count in a pathway must be a fact with an official https source and the day a person read it
 * (see content/pathways/README.md). The tool refuses a pathway that states one as plain words.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { importPathway, listPathways, publishPathway, retirePathway, reviewPathway, validatePathway } from "../lib/pathways/store";

const [command, ...rest] = process.argv.slice(2);
const asAt = rest.indexOf("--as");
const email = asAt >= 0 ? rest[asAt + 1] : undefined;
const args = rest.filter((_, i) => asAt < 0 || (i !== asAt && i !== asAt + 1));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).");
const service = createClient(url, key, { auth: { persistSession: false } });

const read = (file: string) => JSON.parse(readFileSync(file, "utf8")) as unknown;

if (command === "validate" || command === "import") {
  let failed = false;
  for (const file of args) {
    try {
      if (command === "validate") { const spec = validatePathway(read(file)); console.log(`ok   ${file}: ${spec.name} (${spec.facts.length} facts, ${spec.routes.length} routes)`); }
      else { const r = await importPathway(service, read(file)); console.log(`${r.created ? "saved" : "same "} ${file}: version ${r.version}, id ${r.id}`); }
    } catch (e) { failed = true; console.error(`FAIL ${file}\n  ${(e as Error).message.split("; ").join("\n  ")}`); }
  }
  if (failed) process.exitCode = 1;
} else if (command === "review") {
  if (!email) throw new Error("review needs --as <email of a Capabilio admin>");
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`${email} is not a user`);
  const { data: admin } = await service.from("platform_admins" as never).select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) throw new Error(`${email} is not a Capabilio admin. Grant it first: npm run arena:content -- grant-admin ${email}`);
  await reviewPathway(service, args[0], user.id);
  console.log("reviewed");
} else if (command === "publish") {
  const r = await publishPathway(service, args[0]);
  console.log(`published; ${r.covered} goal request(s) covered, ${r.notified} student(s) notified`);
} else if (command === "retire") {
  await retirePathway(service, args[0]);
  console.log("retired");
} else if (command === "list") {
  console.table(await listPathways(service, ["DRAFT", "REVIEWED", "PUBLISHED", "RETIRED"]));
} else {
  console.log("commands: validate | import | review | publish | retire | list (see the header of scripts/pathway-content.mts)");
  process.exitCode = 1;
}
