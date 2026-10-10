// Fills the LeetCode-style bank (cap 1000) ahead of time so weeks are served from the database, not the AI.
//   npm run stream:bulk -- 50      (add up to 50 verified problems; run again for more)
// Each problem costs one or two model calls plus code runs; stops at the cap or after repeated failures.
import { createServiceClient } from "@/lib/supabase/service";
import { bankSize, generateBulk } from "@/lib/arena-challenges/leetcode/weekly";

const n = Number(process.argv[2] ?? 20);
if (!Number.isInteger(n) || n < 1) throw new Error("Usage: npm run stream:bulk -- <how many>");
const service = createServiceClient();
console.log(`bank before: ${await bankSize(service)}`);
const added = await generateBulk(service, n, (a, note) => console.log(`  +${a}${note ? ` (${note})` : ""}`));
console.log(`added ${added}; bank now ${await bankSize(service)}`);
