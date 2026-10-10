// Writes this week's LeetCode-style problems for the IT cluster now (the Sunday cron does the same). Safe to re-run: it only fills what is missing.
//   npm run stream:weekly
import { createServiceClient } from "@/lib/supabase/service";
import { generateWeeklyChallenges, weeklyPool } from "@/lib/arena-challenges/leetcode/weekly";

const service = createServiceClient();
const out = await generateWeeklyChallenges(service);
const pool = await weeklyPool(service);
console.log(out.claimed ? `added ${out.added}` : "another run already holds this week", pool.counts, `total ${pool.total}`);
