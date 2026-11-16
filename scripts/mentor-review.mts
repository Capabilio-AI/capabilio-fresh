// Capabilio's mentor review, from the terminal, until the admin portal exists.
//   npm run mentors:review                          list mentor applications (pending first)
//   npm run mentors:review -- approve <email>       approve  (also: reject, suspend; add --note "text" to tell the applicant why)
import { createServiceClient } from "@/lib/supabase/service";
import { reviewMentor } from "@/lib/pulse/mentors";

const db = createServiceClient() as any;
const [action, who] = process.argv.slice(2);
const noteAt = process.argv.indexOf("--note");
const note = noteAt > -1 ? process.argv[noteAt + 1] : null;

const { data: rows } = await db.from("mentor_profiles").select("user_id, status, headline, company, role_title, years_experience, is_accepting, updated_at").order("updated_at", { ascending: false });
const ids = (rows ?? []).map((r: { user_id: string }) => r.user_id);
const { data: people } = ids.length ? await db.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
const byId = new Map((people ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p]));
const list = (rows ?? []).map((r: any) => ({ email: (byId.get(r.user_id) as any)?.email, name: (byId.get(r.user_id) as any)?.full_name, status: r.status, headline: r.headline, years: r.years_experience, accepting: r.is_accepting }));

if (!action) {
  console.table(list);
  console.log(list.length ? "To decide: npm run mentors:review -- approve <email>" : "No mentor applications yet.");
  process.exit(0);
}
if (!["approve", "reject", "suspend"].includes(action) || !who) { console.error("Usage: npm run mentors:review -- <approve|reject|suspend> <email> [--note \"text\"]"); process.exit(1); }
const person = (people ?? []).find((p: { email: string | null }) => p.email?.toLowerCase() === who.toLowerCase());
if (!person) { console.error(`No mentor application from ${who}. Run without arguments to list them.`); process.exit(1); }
const { data: admin } = await db.from("platform_admins").select("user_id").limit(1).maybeSingle();
const ok = await reviewMentor(db, admin?.user_id ?? person.id, person.id, action as "approve", note);
console.log(ok ? `${action}d: ${who}` : "Nothing changed (no application found).");
