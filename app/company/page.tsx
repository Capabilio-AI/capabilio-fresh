import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getOrgContext } from "@/lib/org/context";

export const metadata: Metadata = { title: "Company — Capabilio AI" };

export default async function CompanyHomePage() {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  return (
    <div>
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">{ctx?.institutionName ?? "Your company"}</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your company account is approved. Hiring tools open here as they are released.</p>
    </div>
  );
}
