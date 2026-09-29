// Operator tool: review and approve pending organisation accounts (service-role key required).
// Manual on purpose: there is no platform-admin auth surface and volume is tiny (docs/org-onboarding-audit.md).
//
//   node --env-file=.env.local scripts/org-approvals.mjs list
//   node --env-file=.env.local scripts/org-approvals.mjs approve <membership-id>
//
// For a pre-existing membership at a specific institution/role use scripts/grant-org-admin.mjs.
import { createClient } from "@supabase/supabase-js";

const [cmd, membershipId] = process.argv.slice(2);
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ORG_ROLES = ["principal", "vice_principal", "hod", "tpo", "company_admin"];

if (cmd === "list") {
  const { data, error } = await s
    .from("institution_memberships")
    .select("id, role, status, created_at, user_id, institutions(name, org_type)")
    .in("role", ORG_ROLES)
    .eq("status", "pending")
    .order("created_at");
  if (error) { console.error(error.message); process.exit(1); }
  for (const m of data) {
    const { data: u } = await s.auth.admin.getUserById(m.user_id);
    console.log(`${m.id}  ${m.institutions?.org_type}  "${m.institutions?.name}"  ${m.role}  ${u?.user?.email}  email_confirmed=${Boolean(u?.user?.email_confirmed_at)}`);
  }
  if (!data.length) console.log("No pending organisation accounts.");
} else if (cmd === "approve" && membershipId) {
  const { data: m } = await s.from("institution_memberships").select("id, role, status, user_id, institutions(org_type)").eq("id", membershipId).maybeSingle();
  if (!m || !ORG_ROLES.includes(m.role)) { console.error("Not a pending organisation membership."); process.exit(1); }
  if (m.status === "active") { console.log("Already active."); process.exit(0); }
  if (m.institutions?.org_type === "company") { console.error("Company accounts have no product surface yet; not approving."); process.exit(1); }
  const { data: u } = await s.auth.admin.getUserById(m.user_id);
  if (!u?.user?.email_confirmed_at) { console.error("Email not confirmed yet; refusing to approve."); process.exit(1); }
  const { error } = await s.from("institution_memberships").update({ status: "active" }).eq("id", m.id);
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Membership ${m.id} (${m.role}) is now active.`);
} else {
  console.error("usage: org-approvals.mjs list | approve <membership-id>");
  process.exit(1);
}
