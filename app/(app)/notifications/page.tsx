import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getDashboardData, DashboardNotReadyError } from "@/lib/dashboard/data";
import { getVaultItems } from "@/lib/vault/data";
import { getGuidePaths } from "@/lib/guide-path/read";
import { matchCareersForStudent } from "@/lib/career/match";
import { computeNextAction } from "@/lib/dashboard/next-action";
import { deriveNotifications, type Notification } from "@/lib/notifications/derive";

export const metadata: Metadata = { title: "Notifications — Capabilio AI" };

const TONE_ICON: Record<Notification["tone"], typeof AlertTriangle> = {
  attention: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const TONE_CLASS: Record<Notification["tone"], string> = {
  attention: "bg-app-warning-container text-app-warning",
  info: "bg-app-blue-container text-app-blue",
  success: "bg-app-success-container text-app-success",
};

export default async function NotificationsPage() {
  const { supabase, user } = await requireAuthedUser();

  let dashboardData;
  try {
    dashboardData = await getDashboardData(supabase, user.id);
  } catch (error) {
    if (error instanceof DashboardNotReadyError) redirect("/assessment");
    throw error;
  }

  const [vaultItems, guidePaths, careerMatches] = await Promise.all([
    getVaultItems(supabase, user.id),
    getGuidePaths(supabase, user.id),
    matchCareersForStudent(supabase, user.id),
  ]);
  const nextAction = computeNextAction(careerMatches[0] ?? null);

  const notifications = deriveNotifications({
    sectionScores: dashboardData.sectionScores,
    topGapSkill: nextAction?.skill ?? null,
    vaultItemCount: vaultItems.length,
    hasGuidePath: guidePaths.primary !== null,
  });

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Notifications</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        What&apos;s worth your attention right now — computed from your current profile, not a static feed.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
            <Sparkles size={20} className="text-app-success" />
            <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">You&apos;re all caught up</p>
            <p className="font-lp-body text-[12.5px] text-app-muted">
              No open items right now — check back as your profile grows.
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = TONE_ICON[n.tone];
            return (
              <Link
                key={n.id}
                href={n.href}
                className="flex items-start gap-3 rounded-xl border border-app-border bg-white p-4 transition-colors hover:bg-app-background"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_CLASS[n.tone]}`}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">{n.title}</p>
                  <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{n.body}</p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
