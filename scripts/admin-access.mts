// Who can open the Capabilio console. An admin is any account with a row in platform_admins; it can be a brand-new account used only for this.
//   npm run admin:access                         list admins
//   npm run admin:access -- grant <email>        make an existing account an admin (the person signs up first)
//   npm run admin:access -- create <email>       create a new account, confirm it, make it an admin; the password is generated and saved to .env.local (ADMIN_EMAIL, ADMIN_PASSWORD), never printed
//   npm run admin:access -- revoke <email>       remove admin access (the account itself is untouched)
import { createServiceClient } from "@/lib/supabase/service";
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { grantPlatformAdmin } from "@/lib/arena-content/store";

const [action, email] = process.argv.slice(2);
const service = createServiceClient() as any;
if (action === "create" && email) {
  const password = randomBytes(14).toString("base64url") + "!7a";
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Capabilio Admin" } });
  if (error) { console.error(`Could not create ${email}: ${error.message}`); process.exit(1); }
  appendFileSync(".env.local", `\nADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\n`);
  await grantPlatformAdmin(service, email);
  console.log(`Created ${email} (id ${data.user.id}) and made it an admin. The password is in .env.local as ADMIN_PASSWORD.`);
} else if (action === "grant" && email) {
  await grantPlatformAdmin(service, email);
  console.log(`${email} can now open /admin`);
} else if (action === "revoke" && email) {
  const { data } = await service.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!data) { console.error(`No account with ${email}.`); process.exit(1); }
  await service.from("platform_admins").delete().eq("user_id", data.id);
  console.log(`${email} is no longer an admin`);
} else {
  const { data: rows } = await service.from("platform_admins").select("user_id");
  const ids = (rows ?? []).map((r: { user_id: string }) => r.user_id);
  const { data: people } = ids.length ? await service.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  console.table(people);
  console.log("Usage: npm run admin:access -- <grant|revoke> <email>");
}
