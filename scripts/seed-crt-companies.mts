// Adds the companies students ask for as EMPTY DRAFTS: a name and a sector, no rounds and no pattern. Nothing here says anything about how a
// company tests; each pattern is entered on /admin/crt-companies with the link it came from and the date it was checked, then published.
// Safe to re-run: a company that already exists is left exactly as it is.
//   npm run crt:seed-companies
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";

const COMPANIES: [name: string, sector: "Technology" | "Finance" | "Management"][] = [
  ["TCS NQT", "Technology"], ["TCS Code Vita", "Technology"], ["Accenture", "Technology"], ["Infosys", "Technology"], ["Wipro", "Technology"], ["Cognizant", "Technology"],
  ["Capgemini", "Technology"], ["HCLTech", "Technology"], ["Tech Mahindra", "Technology"], ["LTIMindtree", "Technology"], ["Mphasis", "Technology"], ["Hexaware", "Technology"],
  ["IBM", "Technology"], ["Zoho", "Technology"], ["Amazon", "Technology"], ["Google", "Technology"], ["Flipkart", "Technology"], ["Virtusa", "Technology"],
  ["Deloitte", "Management"], ["Larsen & Toubro", "Technology"], ["State Street", "Finance"], ["JPMorgan Chase", "Finance"],
];
const slugOf = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const db = untyped(createServiceClient());
let added = 0;
for (const [name, sector] of COMPANIES) {
  const { data } = await db.from("crt_companies").select("id").eq("slug", slugOf(name)).maybeSingle();
  if (data) continue;
  const { error } = await db.from("crt_companies").insert({ slug: slugOf(name), name, sector, status: "DRAFT", process: [] });
  if (error) console.log(`  ${name}: ${error.message}`);
  else added++;
}
console.log(`${added} companies added as drafts, ${COMPANIES.length - added} already there. Fill in each pattern at /admin/crt-companies.`);
