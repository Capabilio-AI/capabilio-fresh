import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { VaultTab } from "@/components/dashboard/VaultTab";

export const metadata: Metadata = { title: "Vault — Capabilio AI" };

export default async function VaultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Vault</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Your private evidence store — certificates, projects, resumes, and links.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>
      <div className="pt-6">
        <VaultTab />
      </div>
    </div>
  );
}
