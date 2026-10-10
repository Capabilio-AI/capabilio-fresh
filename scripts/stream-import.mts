// Stores LeetCode-style problems written outside the app (no AI calls): each is verified by RUNNING its reference and brute-force solutions.
//   npm run stream:import -- data/arena-problems/batch-001.json
import { readFileSync } from "node:fs";
import { createServiceClient } from "@/lib/supabase/service";
import { bankSize, importProblems } from "@/lib/arena-challenges/leetcode/weekly";

const file = process.argv[2];
if (!file) throw new Error("Usage: npm run stream:import -- <file.json>");
const items = JSON.parse(readFileSync(file, "utf8")) as unknown[];
const service = createServiceClient();
console.log(`bank before: ${await bankSize(service)}`);
for (const r of await importProblems(service, items)) console.log(`${r.ok ? "stored  " : r.reason === "already stored" ? "skipped " : "REJECTED"} ${r.title}${r.reason ? ` (${r.reason})` : ""}`);
console.log(`bank now: ${await bankSize(service)}`);
