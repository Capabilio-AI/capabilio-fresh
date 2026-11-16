import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { ORG_ROLES } from "@/lib/admin/rules";
import { can } from "@/lib/admin/permissions";
import { adminDb, countOf, HEAD, requireAdminPage, safe } from "@/lib/admin/db";

export const metadata: Metadata = { title: "Console — Capabilio AI", robots: { index: false, follow: false } };

/** Every page under /admin: Capabilio platform admins only, inside the console's own shell. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminPage(undefined, { allowMustChange: true }); // each page then holds the admin to their own role
  const db = adminDb();
  const seesQueue = can(admin, "lists");
  const [mentors, orgs] = seesQueue ? await Promise.all([
    safe(db.from("mentor_profiles").select("user_id", HEAD).eq("status", "pending"), { count: 0 } as never),
    safe(db.from("institution_memberships").select("id", HEAD).eq("status", "pending").in("role", [...ORG_ROLES]), { count: 0 } as never),
  ]) : [{ count: 0 }, { count: 0 }];
  return <AdminShell email={admin.email} pending={countOf(mentors as never) + countOf(orgs as never)} limits={{ role: admin.role, hideContacts: admin.hideContacts }}>{children}</AdminShell>;
}
