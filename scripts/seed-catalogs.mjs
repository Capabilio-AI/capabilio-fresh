// Operator tool: fill the certification / learning / project catalogs from a JSON file you prepared (format: docs/catalog-seed-format.md).
// The file is validated first; an unknown skill or career key stops the run before anything is written. Safe to re-run.
//
//   node --env-file=.env.local scripts/seed-catalogs.mjs <file.json> [--dry-run]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { applySeed, validateSeed } from "./lib/catalog-seed.mjs";

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error("usage: seed-catalogs.mjs <file.json> [--dry-run]"); process.exit(1); }
let json;
try { json = JSON.parse(readFileSync(file, "utf8")); } catch (e) { console.error(`Could not read ${file}: ${e.message}`); process.exit(1); }
const valid = validateSeed(json);
if (!valid.ok) { console.error("The file has problems:\n" + valid.problems.map((p) => "  - " + p).join("\n")); process.exit(1); }
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const result = await applySeed(client, valid.seed, { dryRun: flags.includes("--dry-run") });
if (!result.ok) { console.error("Nothing was written. Problems:\n" + result.problems.map((p) => "  - " + p).join("\n")); process.exit(1); }
console.log(`${result.dryRun ? "Dry run OK" : "Seeded"}: ${result.counts.certifications} certifications, ${result.counts.learning} learning resources, ${result.counts.projects} projects.`);
