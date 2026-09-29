// Operator tool: activate an EXISTING membership as an organisation admin.
// There is deliberately no approval flow or client path (clients cannot write memberships, and the
// set_membership_status trigger forces privileged roles to 'pending' on insert), so an admin exists
// only when a platform operator runs this with the service-role key.
//
//   node --env-file=.env.local scripts/grant-org-admin.mjs <user-email> <institution-id> [principal|vice_principal|ceo]
import { createClient } from "@supabase/supabase-js";

const [email, institutionId, role = "principal"] = process.argv.slice(2);
if (!email || !institutionId || !["principal", "vice_principal", "ceo"].includes(role)) {
  console.error("usage: grant-org-admin.mjs <user-email> <institution-id> [principal|vice_principal|ceo]");
  process.exit(1);
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: profile } = await s.from("profiles").select("id").eq("email", email).maybeSingle();
if (!profile) { console.error("No account with that email."); process.exit(1); }
const { data: membership } = await s.from("institution_memberships").select("id").eq("user_id", profile.id).eq("institution_id", institutionId).maybeSingle();
if (!membership) { console.error("That user has no membership at that institution."); process.exit(1); }
const { error } = await s.from("institution_memberships").update({ role, status: "active" }).eq("id", membership.id);
if (error) { console.error(error.message); process.exit(1); }
console.log(`Membership ${membership.id} is now ${role}/active.`);
