import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { orgNavFor } from "@/lib/org/nav";
import { untyped } from "@/lib/org/db";
import { PageHeader, Panel, Stat } from "@/components/org/ui";

export const metadata: Metadata = { title: "Organisation — Capabilio AI" };

export default async function OrgHomePage() {
  const { ctx, service } = await orgPageContext();
  const db = untyped(service);
  const [students, projects, drives, pending, profile] = await Promise.all([
    service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId).eq("role", "student").eq("status", "active"),
    db.from("class_projects").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId),
    service.from("opportunities").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId),
    ctx.kind === "admin"
      ? service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId).eq("status", "pending")
      : Promise.resolve({ count: null }),
    db.from("org_profiles").select("is_public").eq("institution_id", ctx.institutionId).maybeSingle(),
  ]);
  const links = orgNavFor(ctx.kind).filter((n) => n.href !== "/org");

  return (
    <div>
      <PageHeader title={ctx.institutionName} subtitle="Your organisation workspace. Everything here is scoped to this institution only." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active students" value={students.count ?? 0} />
        <Stat label="Projects" value={projects.count ?? 0} />
        <Stat label="Placement drives" value={drives.count ?? 0} />
        {ctx.kind === "admin" && <Stat label="Pending members" value={pending.count ?? 0} />}
      </div>
      <Panel title="Where to next" className="mt-6">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block rounded-lg border border-app-border px-4 py-3 font-lp-body text-[13.5px] font-medium text-app-charcoal hover:bg-black/5">
                {l.label} →
              </Link>
            </li>
          ))}
        </ul>
        {(profile.data as { is_public: boolean } | null)?.is_public && (
          <p className="mt-4 font-lp-body text-[12.5px] text-app-muted">
            Your public page is live:{" "}
            <Link href={`/o/${ctx.institutionSlug}`} className="text-app-blue hover:underline">
              /o/{ctx.institutionSlug}
            </Link>
          </p>
        )}
      </Panel>
    </div>
  );
}
