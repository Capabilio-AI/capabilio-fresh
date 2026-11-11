import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin } from "@/lib/arena-content/store";
import { listAllCompanies } from "@/lib/crt/company-server";
import { CrtCompaniesAdmin } from "@/components/crt/admin/CrtCompaniesAdmin";

export const metadata: Metadata = { title: "CRT companies — Admin — Capabilio AI" };

/** Capabilio admins only; everyone else gets a 404. */
export default async function CrtCompaniesAdminPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  if (!(await isPlatformAdmin(service, user.id))) notFound();
  return (
    <div>
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">CRT companies</h1>
      <p className="mt-1 max-w-[70ch] font-lp-body text-[13px] text-app-muted">Each company&apos;s hiring process and test pattern. A company reaches students only when it is published, and publishing needs the link the pattern came from and the date it was checked: companies change their tests every year, so never publish from memory.</p>
      <div className="pt-6"><CrtCompaniesAdmin initial={await listAllCompanies(service)} /></div>
    </div>
  );
}
