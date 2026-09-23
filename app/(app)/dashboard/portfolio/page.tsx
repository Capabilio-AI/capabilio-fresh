import type { Metadata } from "next";
import { Award, ExternalLink, FileText, Link2, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getVaultItems } from "@/lib/vault/data";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";

export const metadata: Metadata = { title: "Portfolio — Capabilio AI" };

const TYPE_ICON: Record<string, LucideIcon> = {
  certificate: Award,
  project: Sparkles,
  resume: FileText,
  link: Link2,
  other: FileText,
};

export default async function PortfolioPage() {
  const { supabase, user } = await requireAuthedUser();

  const [items, { data: rating }] = await Promise.all([
    getVaultItems(supabase, user.id),
    supabase.from("arena_ratings").select("rating").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Portfolio</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Your public-facing evidence. Vault is where you add it; Portfolio is how it's shown.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="pt-6">
        {rating && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-app-border bg-white p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-orange-container text-app-orange">
              <Trophy size={18} />
            </span>
            <div>
              <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">Arena rating: {rating.rating}</p>
              <p className="font-lp-mono text-[11px] text-app-muted">Earned from timed challenge performance</p>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
            <p className="font-lp-body text-[13.5px] text-app-muted">
              Nothing to show yet. Add certificates, projects, or links to your Vault — they'll appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const Icon = TYPE_ICON[item.item_type] ?? FileText;
              return (
                <div key={item.id} className="rounded-xl border border-app-border bg-white p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-background text-app-muted">
                    <Icon size={16} />
                  </span>
                  <p className="mt-3 font-lp-body text-[14px] font-semibold text-app-charcoal">{item.title}</p>
                  <p className="mt-0.5 font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
                    {item.item_type}
                  </p>
                  {item.description && (
                    <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">{item.description}</p>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1 font-lp-mono text-[11px] text-app-blue hover:underline"
                    >
                      <ExternalLink size={12} />
                      View
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
