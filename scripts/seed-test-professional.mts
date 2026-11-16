// Creates (or refreshes) ONE test professional with 13 years of dated work history, so the mentor flow can be tried end to end.
// The password is generated here and written to .env.local (TEST_PRO_EMAIL, TEST_PRO_PASSWORD); it is never printed.
//   node --env-file=.env.local --import tsx scripts/seed-test-professional.mts
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { createServiceClient } from "@/lib/supabase/service";

const EMAIL = "pro.mentor.test@capabilio.test";
const NAME = "Test Mentor (Professional)";
const db = createServiceClient() as any;

const env = readFileSync(".env.local", "utf8");
const saved = env.match(/^TEST_PRO_PASSWORD=(.*)$/m)?.[1];
const password = saved || randomBytes(12).toString("base64url") + "!9a";

const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
let user = list?.users?.find((u: { email?: string }) => u.email === EMAIL);
if (!user) {
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL, password, email_confirm: true,
    user_metadata: { full_name: NAME, path: "professional", employer_name: "Northwind Test Systems", job_title: "Engineering Manager" },
  });
  if (error) throw error;
  user = data.user;
} else if (saved) {
  await db.auth.admin.updateUserById(user.id, { password });
}
if (!saved) appendFileSync(".env.local", `\nTEST_PRO_EMAIL=${EMAIL}\nTEST_PRO_PASSWORD=${password}\n`);

const id = user.id as string;
await db.from("pro_profiles").upsert({ user_id: id, employer_name: "Northwind Test Systems", job_title: "Engineering Manager", headline: "Engineering manager, 13 years in software delivery", about: "Test account for trying the mentor flow.", location: "Hyderabad" }, { onConflict: "user_id" });
await db.from("pro_employment").delete().eq("user_id", id);
const { error } = await db.from("pro_employment").insert([
  { user_id: id, employer_name: "Contoso Test Labs", job_title: "Software Engineer", start_date: "2013-07-01", end_date: "2017-06-30", source: "entered" },
  { user_id: id, employer_name: "Fabrikam Test Works", job_title: "Senior Engineer", start_date: "2017-07-01", end_date: "2021-03-31", source: "entered" },
  { user_id: id, employer_name: "Northwind Test Systems", job_title: "Engineering Manager", start_date: "2021-04-01", end_date: null, source: "entered" },
]);
if (error) throw error;
await db.from("pro_verification").upsert({ user_id: id, window_ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }, { onConflict: "user_id", ignoreDuplicates: true });
const { data: p } = await db.from("profiles").select("student_status, full_name").eq("id", id).single();
console.log("ready:", { email: EMAIL, stage: p?.student_status, name: p?.full_name, rows: 3 });
