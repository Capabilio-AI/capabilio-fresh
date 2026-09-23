import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PulseTabs } from "@/components/pulse/PulseTabs";
import { PulseSidebar } from "@/components/pulse/PulseSidebar";

export const metadata: Metadata = {
  title: "Pulse — Capabilio AI",
  description: "See what your peers are building.",
};

export default async function PulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Pulse</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your professional student network.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <PulseTabs />
        <div className="hidden lg:block">
          <PulseSidebar />
        </div>
      </div>
    </div>
  );
}
