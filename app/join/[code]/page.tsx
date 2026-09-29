import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { initialsOf } from "@/lib/org/format";
import { untyped, type OrgProfileRow } from "@/lib/org/db";
import { OrgTheme } from "@/components/org/OrgTheme";

export const metadata: Metadata = { title: "Join your college on Capabilio AI" };

interface LinkInfo {
  institution_id: string;
  active: boolean;
}

/** A student opens their college's join link: see the college, then continue to the normal student sign-up. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const service = createServiceClient();
  const db = untyped(service);
  const clean = /^[a-z0-9]{8,32}$/.test(code) ? code : "";
  const { data } = clean ? await db.from("org_join_links").select("institution_id, active").eq("code", clean).maybeSingle() : { data: null };
  const link = data as LinkInfo | null;

  let name = "";
  let logo: string | null = null;
  let verified = false;
  if (link?.active) {
    const [{ data: inst }, { data: profile }, verifyRes] = await Promise.all([
      service.from("institutions").select("name").eq("id", link.institution_id).maybeSingle(),
      db.from("org_profiles").select("*").eq("institution_id", link.institution_id).maybeSingle(),
      service.from("institution_memberships").select("id", { count: "exact", head: true }).eq("institution_id", link.institution_id).eq("status", "active").in("role", ["principal", "vice_principal", "tpo"] as never[]),
    ]);
    name = inst?.name ?? "";
    logo = (profile as OrgProfileRow | null)?.logo_url ?? null;
    verified = (verifyRes.count ?? 0) > 0;
  }

  return (
    <OrgTheme>
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        {link?.active && name ? (
          <div className="o-card p-7 text-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
              <img src={logo} alt="" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <span className="o-logo-tile mx-auto h-16 w-16 rounded-2xl text-[22px]" aria-hidden="true">
                {initialsOf(name)}
              </span>
            )}
            <p className="o-eyebrow mt-5">You&apos;re invited to join</p>
            <h1 className="o-serif mt-1 text-[32px] leading-tight text-app-charcoal">{name}</h1>
            {verified && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-app-success">
                <BadgeCheck size={14} aria-hidden="true" /> Approved by the Capabilio team
              </p>
            )}
            <p className="mt-4 text-[13.5px] leading-relaxed text-app-muted">
              Build a profile of what you can actually do, verified through practice and your college&apos;s own projects, and see your college&apos;s classroom and placement drives in one place.
            </p>
            <Link href={`/signup?join=${clean}`} className="o-btn mt-6 w-full !py-3">
              Create your student account
            </Link>
            <p className="mt-4 text-[12.5px] text-app-muted">
              Already on Capabilio?{" "}
              <Link href="/login" className="font-semibold text-app-orange hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        ) : (
          <div className="o-card p-7 text-center">
            <h1 className="o-serif text-[28px] text-app-charcoal">This link isn&apos;t active</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-app-muted">Ask your college for a new join link, or sign up and pick your college from the list.</p>
            <Link href="/signup" className="o-btn mt-5">
              Sign up
            </Link>
          </div>
        )}
      </main>
    </OrgTheme>
  );
}
